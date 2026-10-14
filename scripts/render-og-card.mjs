import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

// Run with Node 22: node scripts/render-og-card.mjs
// Requires google-chrome and local Noto Sans / Noto Sans Devanagari fonts.
// ponytail: The HTML falls back to regular Devanagari; install the local Medium face for exact weight 500.
const profile = await mkdtemp(join(tmpdir(), "vn-og-card-"));
const chrome = spawn("google-chrome", [
  "--headless", "--no-sandbox", "--disable-dev-shm-usage",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });
let socket;
let launchError;
chrome.on("error", (error) => { launchError = error; });
const pending = new Map();
let nextId = 0;

function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timed out: ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    if (chrome.exitCode !== null) throw new Error("Chrome exited before starting CDP");
    try {
      port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0];
      break;
    } catch {
      await delay(100);
    }
  }
  if (!port) throw new Error("Chrome did not start CDP within 10 seconds");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((entry) => entry.type === "page");
  if (!target) throw new Error("Chrome did not provide a page target");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP connection timed out")), 10000);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP connection failed")); }, { once: true });
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1200, height: 630, deviceScaleFactor: 1, mobile: false,
  });
  const navigation = await send("Page.navigate", { url: new URL("./og-card.html", import.meta.url).href });
  if (navigation.errorText) throw new Error(navigation.errorText);
  // Wait for the new document before asking it to load fonts and decode the logo.
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await send("Runtime.evaluate", {
      expression: 'location.href.endsWith("/og-card.html") && document.readyState === "complete"',
      returnByValue: true,
    });
    if (result.result.value) { ready = true; break; }
    await delay(100);
  }
  if (!ready) throw new Error("Card document did not finish loading");
  const assets = await send("Runtime.evaluate", {
    expression: `(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
      if ([...document.fonts].some((font) => font.status !== "loaded")) throw new Error("Local Noto fonts are missing");
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return true;
    })()`,
    awaitPromise: true, returnByValue: true,
  });
  if (assets.exceptionDetails) throw new Error(JSON.stringify(assets.exceptionDetails));
  const capture = await send("Page.captureScreenshot", {
    format: "png", captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 },
  });
  const png = Buffer.from(capture.data, "base64");
  if (png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630) throw new Error("Unexpected PNG dimensions");
  if (png.length >= 200000) throw new Error("Card exceeds 200 KB; simplify the render before saving");
  const output = fileURLToPath(new URL("../public/brand/og-card.png", import.meta.url));
  await writeFile(output, png);
  console.log(`Rendered ${output} (1200x630, ${png.length} bytes)`);
} finally {
  for (const request of pending.values()) clearTimeout(request.timer);
  socket?.close();
  const exited = chrome.exitCode !== null || launchError
    ? Promise.resolve()
    : new Promise((resolve) => chrome.once("exit", resolve));
  chrome.kill("SIGKILL");
  await exited;
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
