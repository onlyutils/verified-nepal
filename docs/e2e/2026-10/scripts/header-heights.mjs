import { launch } from "./cdp.mjs";
const SHOT = process.env.SHOT;
const login = async (e) => (await (await fetch("https://auth.onlyutils.com/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: "E2eTest!2026Pass", client_id: "ou_client_34HIKupJ5afWl0DIoh7zi" }) })).json());
const m = `(()=>{const h=document.querySelector('header');const hs=h?Math.round(h.getBoundingClientRect().height):null;const spans=[...(h||document).querySelectorAll('span[lang]')].filter(s=>/भेरिफाइड|Verified/.test(s.innerText)).map(s=>({t:s.innerText,clipped:s.scrollWidth>s.clientWidth+1||getComputedStyle(s).textOverflow==='ellipsis'&&s.scrollWidth>s.clientWidth}));return {hdrH:hs,wordmark:spans.map(s=>s.t+(s.clipped?' [CLIPPED]':'')),over:document.documentElement.scrollWidth-document.documentElement.clientWidth}})()`;
const b = await launch(); const o = {};
for (const [label, scale, w] of [["360 normal", null, 360], ["320 @150%", "150", 320]]) {
  await b.viewport(w, 740);
  for (const mode of ["out", "in", "desk"]) for (const lang of ["ne", "en"]) {
    await b.goto("https://dev.verifiednepal.com/", 1000);
    const tok = mode === "out" ? null : await login(mode === "desk" ? "admin-beta-tester@verifiednepal.com" : "helper-01-beta-tester@verifiednepal.com");
    await b.ev(`localStorage.setItem('verifiednepal:language','${lang}');` + (scale ? `localStorage.setItem('vn:text-scale','${scale}');` : "localStorage.removeItem('vn:text-scale');") + (tok ? `localStorage.setItem('ou_tokens', JSON.stringify(${JSON.stringify({ access_token: tok.access_token, refresh_token: tok.refresh_token, expires_in: 900 })}))` : "localStorage.removeItem('ou_tokens')"));
    await b.goto("https://dev.verifiednepal.com" + (mode === "desk" ? "/desk" : "/"), 6500);
    const r = await b.ev(m);
    o[`${label} | ${mode} | ${lang}`] = r;
    if (label === "360 normal" && lang === "ne" && mode !== "in") await b.shot(`${SHOT}/hdr-final-${mode}-360-ne.png`);
  }
}
for (const [k, v] of Object.entries(o)) console.log(k.padEnd(28), "header", String(v.hdrH).padStart(3), "px | overflow", v.over, "|", v.wordmark.join(" / "));
b.close();
