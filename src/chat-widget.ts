/**
 * The OnlyUtils chat widget ships no theming hooks, but it renders into an open
 * shadow root and reads `--ouc-*` custom properties. So: set the variables on
 * the host, inject one stylesheet for the parts variables cannot reach, and stamp the
 * verifiedNepal mark plus the OnlyUtils credit into its DOM.
 */
const HOST_ID = "onyutils-chat-widget";
const ONLYUTILS_URL = "https://onlyutils.com";

const hostVars = {
  "--ouc-primary": "#003893",
  "--ouc-primary-fg": "#FFFFFF",
  "--ouc-bg": "#FFFFFF",
  "--ouc-text": "#0A0A0A",
  "--ouc-muted": "#6B6B6B",
  "--ouc-border": "#E3E3E3",
  "--ouc-assistant-bg": "#FFFFFF",
  "--ouc-radius": "0",
  "--ouc-radius-sm": "0",
  "--ouc-launcher-size": "56px",
  "--ouc-shadow": "0 12px 24px -16px rgba(10, 10, 10, 0.5)",
  "--ouc-font": 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", sans-serif',
};

/* Editorial theme: paper, ink, one red accent, hairlines, square geometry, no motion. */
const shadowCss = `
.ouc-launcher {
  background: #0A0A0A;
  border: 1px solid #FFFFFF;
  border-radius: 0;
  box-shadow: 0 0 0 1px #0A0A0A, 0 8px 20px -12px rgba(10, 10, 10, 0.6);
  overflow: hidden;
  padding: 0;
}
.ouc-launcher img { width: 30px; height: 30px; }

.ouc-panel {
  border: 1px solid #0A0A0A;
  border-radius: 0;
  background: #FFFFFF;
}

.ouc-header {
  background: #FFFFFF;
  border-bottom: 4px double #0A0A0A;
  gap: 10px;
}
.ouc-title {
  font-family: "Playfair Display", "Noto Serif Devanagari", Georgia, serif;
  font-weight: 700;
  letter-spacing: 0;
  color: #0A0A0A;
}
.vn-chat-brand { display: flex; align-items: center; gap: 9px; flex: 1; min-width: 0; }
.vn-chat-brand img { width: 24px; height: 24px; flex: none; }

.ouc-msg { border: 1px solid transparent; border-radius: 0; }
.ouc-msg-assistant { background: #FFFFFF; border-color: #E3E3E3; border-left: 2px solid #003893; }
.ouc-msg-user { background: #0A0A0A; color: #FFFFFF; }
.ouc-msg strong { font-weight: 600; }
.ouc-tel {
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  color: #DC143C;
}

.ouc-chip {
  background: transparent;
  border: 1px solid #0A0A0A;
  border-radius: 0;
  color: #0A0A0A;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
}
.ouc-chip:hover { background: #0A0A0A; color: #FFFFFF; border-color: #0A0A0A; }

.ouc-composer { border-top: 1px solid #E3E3E3; background: #FFFFFF; }
.ouc-input { background: #FFFFFF; border: 1px solid #E3E3E3; border-radius: 0; color: #0A0A0A; }
.ouc-input:focus-visible { outline: none; border-color: #0A0A0A; box-shadow: 0 0 0 2px rgba(0, 56, 147, 0.25); }
.ouc-mic { background: #FFFFFF; border-radius: 0; color: #6B6B6B; }
.ouc-send { background: #0A0A0A; border-radius: 0; color: #FFFFFF; }
.ouc-send:hover:not(:disabled) { background: #DC143C; }

.vn-chat-credit {
  flex: none;
  padding: 7px 12px 10px;
  text-align: center;
  font-size: 11px;
  line-height: 1.4;
  color: #6B6B6B;
  border-top: 1px solid #E3E3E3;
}
.vn-chat-credit a { color: #0A0A0A; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }

@media (max-width: 639px) {
  .ouc-launcher { bottom: 88px !important; }
}
`;

function decorate(root: ShadowRoot) {
  const style = document.createElement("style");
  style.textContent = shadowCss;
  root.appendChild(style);

  const launcher = root.querySelector(".ouc-launcher");
  if (launcher) {
    launcher.innerHTML = '<img src="/brand/logo-mark-light.svg" alt="">';
  }

  const title = root.querySelector(".ouc-title");
  if (title && !title.querySelector("img")) {
    const wrap = document.createElement("span");
    wrap.className = "vn-chat-brand";
    wrap.innerHTML = '<img src="/brand/logo-mark.svg" alt="">';
    title.replaceWith(wrap);
    wrap.appendChild(title);
  }

  const panel = root.querySelector(".ouc-panel");
  if (panel) {
    const credit = document.createElement("div");
    credit.className = "vn-chat-credit";
    credit.innerHTML = `Powered by <a href="${ONLYUTILS_URL}" target="_blank" rel="noreferrer noopener">OnlyUtils</a>`;
    panel.appendChild(credit);
  }
}

export function brandChatWidget() {
  let tries = 0;
  const timer = window.setInterval(() => {
    const host = document.getElementById(HOST_ID);
    if (host?.shadowRoot?.querySelector(".ouc-panel")) {
      window.clearInterval(timer);
      Object.entries(hostVars).forEach(([key, value]) => host.style.setProperty(key, value));
      decorate(host.shadowRoot);
    } else if (++tries > 40) {
      window.clearInterval(timer);
    }
  }, 250);
}

let chatWidgetPromise: Promise<void> | null = null;
let chatWidgetLoaded = false;

export function ensureChatWidget(): Promise<void> {
  if (chatWidgetLoaded) return Promise.resolve();
  if (chatWidgetPromise) return chatWidgetPromise;
  const src = (import.meta.env.VITE_CHAT_WIDGET_SRC as string | undefined)?.trim();
  if (!src || src === "%VITE_CHAT_WIDGET_SRC%") return Promise.resolve();

  const dataKey = (import.meta.env.VITE_CHAT_KEY as string | undefined) || "";
  const dataApi = (import.meta.env.VITE_CHAT_API as string | undefined) || "";

  chatWidgetPromise = new Promise<void>((resolve) => {
    const startPolling = () => {
      let tries = 0;
      const timer = window.setInterval(() => {
        const host = document.getElementById(HOST_ID);
        const ready = Boolean(host?.shadowRoot?.querySelector(".ouc-panel") || (window as unknown as { OnyutilsChat?: unknown }).OnyutilsChat);
        if (ready) {
          window.clearInterval(timer);
          chatWidgetLoaded = true;
          brandChatWidget();
          try {
            const saved = localStorage.getItem("vn:region");
            const api = (window as unknown as { OnyutilsChat?: { setContext?: (t: string) => void } }).OnyutilsChat;
            if (api?.setContext && saved) api.setContext(`Visitor's selected district: ${saved}`);
          } catch {}
          resolve();
        } else if (++tries > 40) {
          window.clearInterval(timer);
          chatWidgetLoaded = true;
          resolve();
        }
      }, 250);
    };

    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if ((existing as unknown as { _vnLoaded?: boolean })._vnLoaded) {
        startPolling();
      } else {
        existing.addEventListener("load", () => { (existing as unknown as { _vnLoaded?: boolean })._vnLoaded = true; startPolling(); }, { once: true });
        existing.addEventListener("error", () => resolve(), { once: true });
        startPolling();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    if (dataKey) script.setAttribute("data-key", dataKey);
    if (dataApi) script.setAttribute("data-api", dataApi);
    script.setAttribute("data-greeting", "I'm here to help. Ask about rescued or missing people, relief locations, or how to get help.");
    script.defer = true;
    script.addEventListener("load", () => { (script as unknown as { _vnLoaded?: boolean })._vnLoaded = true; startPolling(); }, { once: true });
    script.addEventListener("error", () => resolve(), { once: true });
    document.body.appendChild(script);
    startPolling();
  });

  return chatWidgetPromise;
}

export async function openChatWidget() {
  await ensureChatWidget();
  const root = document.getElementById(HOST_ID)?.shadowRoot;
  const panel = root?.querySelector(".ouc-panel");
  if (panel && !panel.classList.contains("ouc-open")) {
    root?.querySelector<HTMLButtonElement>(".ouc-launcher")?.click();
  }
  if (!panel) {
    const host = document.getElementById(HOST_ID)?.shadowRoot?.querySelector<HTMLButtonElement>(".ouc-launcher");
    host?.click();
  }
}

export function wireRegionContext() {
  const send = (region: string) => {
    const api = (window as unknown as { OnyutilsChat?: { setContext?: (t: string) => void } }).OnyutilsChat;
    if (!api?.setContext) return;
    api.setContext(region ? `Visitor's selected district: ${region}` : "");
  };
  try {
    const saved = localStorage.getItem("vn:region");
    if (saved) send(saved);
  } catch {}
  window.addEventListener("vn:region-change", (event) => {
    send(String((event as CustomEvent<{ region?: string }>).detail?.region ?? ""));
  });
}

function shouldPreload(): boolean {
  const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData) return false;
  const eff = conn?.effectiveType;
  if (eff === "slow-2g" || eff === "2g") return false;
  return true;
}

function scheduleIdlePreload() {
  if (!shouldPreload()) return;
  const run = () => { void ensureChatWidget(); };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === "function") ric(run, { timeout: 4000 });
  else window.setTimeout(run, 4000);
}

if (typeof window !== "undefined") {
  if (document.readyState === "complete") scheduleIdlePreload();
  else window.addEventListener("load", scheduleIdlePreload, { once: true });
}
