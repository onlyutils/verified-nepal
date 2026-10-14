import { launch } from "./cdp.mjs";
const A = "https://api.dev.verifiednepal.com";
const login = async (e) => (await (await fetch("https://auth.onlyutils.com/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: "E2eTest!2026Pass", client_id: "ou_client_34HIKupJ5afWl0DIoh7zi" }) })).json());
const newsId = (await (await fetch(A + "/dispatches?kind=news")).json()).items[0]?.id;
const pages = (process.env.PAGES ? process.env.PAGES.split(",") : ["/", "/me", "/get-help", "/give-help", "/search", "/articles", `/articles/${newsId}`, "/ledger", "/drop-centers", "/incidents", "/projects", "/climate", "/missing", "/poster", "/report-incident", "/register-organization", "/our-message", "/info", "/desk"]);
const probe = `(()=>{const vw=document.documentElement.clientWidth;const bad=[];for(const e of document.body.querySelectorAll('*')){if(e instanceof SVGElement&&!(e instanceof SVGSVGElement))continue;const r=e.getBoundingClientRect();if(r.width>0&&r.right>vw+1&&!bad.some(b=>b.el.contains(e))){bad.push({el:e,tag:e.tagName.toLowerCase(),right:Math.round(r.right),text:(e.innerText||e.getAttribute('aria-label')||'').replace(/\\s+/g,' ').slice(0,36),cls:String(e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className).slice(0,50)})}}return {over:document.documentElement.scrollWidth-vw,bad:bad.slice(0,4).map(({el,...r})=>r)}})()`;
const b = await launch(); const res = {};
await b.viewport(320, 640);
if (process.env.WARM) { for (const p of pages) { await b.goto("https://dev.verifiednepal.com" + p, 2500); } }
for (const mode of (process.env.MODES ? process.env.MODES.split(",") : ["out", "in"])) for (const lang of ["ne", "en"]) {
  await b.goto("https://dev.verifiednepal.com/", 1200);
  const tok = mode === "in" ? await login("helper-01-beta-tester@verifiednepal.com") : null;
  await b.ev(`localStorage.setItem('verifiednepal:language','${lang}');localStorage.setItem('vn:text-scale','150');` + (tok ? `localStorage.setItem('ou_tokens', JSON.stringify(${JSON.stringify({ access_token: tok.access_token, refresh_token: tok.refresh_token, expires_in: 900 })}))` : "localStorage.removeItem('ou_tokens')"));
  for (const p of pages) {
    if (p === "/desk" && mode === "out") continue;
    await b.goto("https://dev.verifiednepal.com" + p, 5500);
    const r = await b.ev(probe);
    if (r.over > 0) (res[`${mode}/${lang}`] ||= []).push({ page: p, over: r.over, bad: r.bad });
  }
}
console.log(JSON.stringify(res, null, 1)); b.close();
