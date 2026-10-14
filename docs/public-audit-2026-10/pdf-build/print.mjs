import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const [,, htmlPath, pdfPath] = process.argv;
const port = 9340 + Math.floor(Math.random()*50);
const chrome = spawn("google-chrome", ["--headless=new","--no-sandbox","--disable-gpu",`--remote-debugging-port=${port}`,"--user-data-dir=/tmp/claude-1000/chrome-pdf-profile","--font-render-hinting=none","about:blank"],{stdio:"ignore"});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i=0;i<50;i++){ try{ targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if(targets.length) break;}catch{} await sleep(200); }
const ws = new WebSocket(targets.find(t=>t.type==="page").webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id);} };
const send = (method, params={}) => new Promise((res, rej) => { const i=++id; pending.set(i, m => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)); ws.send(JSON.stringify({id:i,method,params})); });
await send("Page.enable");
await send("Page.navigate", {url: "file://" + htmlPath});
await sleep(1500);
await send("Runtime.evaluate", {expression: "document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>i.onload=i.onerror=r))))", awaitPromise: true});
await sleep(500);
const footer = `<div style="width:100%;padding:0 18mm;font-size:7.5px;color:#7b8494;font-family:'Noto Sans',sans-serif;display:flex;justify-content:space-between"><span>Verified Nepal &middot; Public-site audit &middot; 14 October 2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
const r = await send("Page.printToPDF", {
  paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.7, marginBottom: 0.8, marginLeft: 0.7, marginRight: 0.7,
  printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: footer,
  generateDocumentOutline: true, generateTaggedPDF: true, preferCSSPageSize: false });
writeFileSync(pdfPath, Buffer.from(r.data, "base64"));
ws.close(); chrome.kill();
console.log("pdf written", pdfPath);
