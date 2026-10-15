// E2E for the public /local-updates page on dev. Usage: SHOT=<dir> node local-updates-page.mjs
import { launch } from "./cdp.mjs";
const SHOT = process.env.SHOT || "/tmp";
const BASE = process.env.BASE || "https://dev.verifiednepal.com";
const API = process.env.API || "https://api.dev.verifiednepal.com";
const rows = [];
const check = (name, ok, detail = "") => { rows.push({ name, ok: !!ok, detail }); console.log(ok ? "PASS" : "FAIL", name, detail); };

const apiItems = (await (await fetch(`${API}/dispatches?kind=news`)).json()).items.filter((i) => i.kind === "news");
check("API: published local updates exist", apiItems.length > 0, `${apiItems.length} items`);

const html = await (await fetch(`${BASE}/local-updates`, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" } })).text();
check("Crawler HTML: title and canonical", /<title>[^<]*Local updates/.test(html) && /rel="canonical" href="https:\/\/[^"]*\/local-updates"/.test(html), (html.match(/<title>[^<]*/) || [""])[0]);
const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
check("sitemap.xml lists /local-updates", sitemap.includes("/local-updates"));

const overflow = `document.documentElement.scrollWidth-document.documentElement.clientWidth`;
const b = await launch();
const setPrefs = (lang, scale) => b.ev(`localStorage.setItem('verifiednepal:language','${lang}');` + (scale ? `localStorage.setItem('vn:text-scale','${scale}');` : `localStorage.removeItem('vn:text-scale');`) + `localStorage.removeItem('ou_tokens')`);

for (const lang of ["ne", "en"]) {
  await b.viewport(360, 740);
  await b.goto(`${BASE}/`, 1200); await setPrefs(lang, null);
  await b.goto(`${BASE}/local-updates`, 6000);
  const page = await b.ev(`(()=>{const h1=document.querySelector('main h1')?.innerText;const links=[...document.querySelectorAll('main a[href^="/articles/"]')];return {h1,title:document.title,n:links.length,ids:links.map(a=>a.getAttribute('href').split('/').pop()),badges:[...document.querySelectorAll('main')].map(m=>m.innerText).join(' ').match(/Checked|जाँच गरिएको|Official source|आधिकारिक स्रोत/g)?.length||0,ctas:[...document.querySelectorAll('main a,main button')].map(e=>e.innerText.trim()).filter(t=>/Get help|Give help|सहयोग माग्नुहोस्|सहयोग गर्नुहोस्/.test(t)),text:document.querySelector('main')?.innerText.slice(0,900)}})()`);
  const want = lang === "ne" ? "स्थानीय अपडेट" : "Local updates";
  check(`[${lang}] heading and document title`, page.h1 === want && page.title.includes(want), `h1=${page.h1} title=${page.title}`);
  check(`[${lang}] every API item is listed, each linking to /articles/:id`, apiItems.every((i) => page.ids.includes(i.id)), `${page.n} links for ${apiItems.length} items`);
  check(`[${lang}] each row has a trust badge`, page.badges >= apiItems.length, `${page.badges} badges`);
  check(`[${lang}] Get help / Give help block at the bottom`, page.ctas.length >= 2, page.ctas.join(" | "));
  const order = await b.ev(`[...document.querySelectorAll('main time')].map(t=>Date.parse(t.getAttribute('datetime'))).filter(Number.isFinite)`);
  check(`[${lang}] newest first`, order.every((v, i) => i === 0 || order[i - 1] >= v), `${order.length} dates`);
  await b.shot(`${SHOT}/lu-page-360-${lang}.png`);
  // open the first item
  await b.ev(`document.querySelector('main a[href^="/articles/"]').click()`);
  await b.sleep(3500);
  const d = await b.ev(`({path:location.pathname,h1:document.querySelector('main h1')?.innerText})`);
  check(`[${lang}] first row opens its detail page`, d.path.startsWith("/articles/") && !!d.h1, `${d.path} ${d.h1?.slice(0, 40)}`);
}

// overflow at 320 px with 150% text
for (const lang of ["ne", "en"]) {
  await b.viewport(320, 640);
  await b.goto(`${BASE}/`, 1200); await setPrefs(lang, "150");
  await b.goto(`${BASE}/local-updates`, 6500);
  const o = await b.ev(overflow);
  check(`[${lang}] /local-updates no sideways scroll at 320 px, 150% text`, o <= 0, `overflow ${o}`);
  await b.shot(`${SHOT}/lu-page-320-150-${lang}.png`);
}

// menu entry: mobile sheet and desktop dropdown
await b.viewport(360, 740);
await b.goto(`${BASE}/`, 1200); await setPrefs("en", null);
await b.goto(`${BASE}/`, 5000);
await b.ev(`document.querySelector('header button[aria-label="Menu"]').click()`); await b.sleep(800);
const mob = await b.ev(`(()=>{const d=document.querySelector('[role=dialog] details');d.open=true;const items=[...d.querySelectorAll('button')].map(x=>x.innerText.trim());return {items,primary:[...document.querySelectorAll('[role=dialog] nav > div button, [role=dialog] nav > button')].map(x=>x.innerText.trim()).slice(0,4)}})()`);
check("Mobile menu: Local updates is first under More", mob.items[0] === "Local updates", mob.items.join(" | "));
check("Mobile menu: Get help and Give help stay at positions 2 and 3", mob.primary[1] === "Get help" && mob.primary[2] === "Give help", mob.primary.join(" | "));
await b.shot(`${SHOT}/lu-menu-360.png`);
await b.ev(`[...document.querySelectorAll('[role=dialog] details button')].find(x=>x.innerText.trim()==='Local updates').click()`); await b.sleep(3500);
check("Mobile menu link opens /local-updates", (await b.ev(`location.pathname`)) === "/local-updates");

await b.viewport(1280, 800);
await b.goto(`${BASE}/`, 5000);
const rect = await b.ev(`(()=>{const e=[...document.querySelectorAll('header nav button')].find(x=>x.innerText.trim()==='More');const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
await b.click(rect.x, rect.y); await b.sleep(800);
const desk = await b.ev(`[...document.querySelectorAll('[role=menuitem]')].map(x=>x.innerText.trim())`);
check("Desktop More dropdown: Local updates is first", desk[0] === "Local updates", desk.join(" | "));
await b.shot(`${SHOT}/lu-menu-1280.png`);

// home: core promise and the strip link
await b.viewport(360, 740);
await b.goto(`${BASE}/`, 7000);
const home = await b.ev(`(()=>{const q=(re)=>[...document.querySelectorAll('main a,main button')].find(e=>re.test(e.innerText.trim()));const g=q(/^Get help$/),v=q(/^Give help$/),s=q(/^See all local updates$/);const bottom=(e)=>e?Math.round(e.getBoundingClientRect().bottom):null;return {get:bottom(g),give:bottom(v),see:!!s,href:s?.getAttribute('href')||s?.closest('a')?.getAttribute('href')}})()`);
check("Home 360x740: Get help and Give help above the fold", home.get !== null && home.give !== null && home.get <= 740 && home.give <= 740, `bottoms ${home.get} / ${home.give}`);
await b.shot(`${SHOT}/lu-home-360.png`);
check("Home: Now strip has 'See all local updates' to /local-updates", home.see && home.href === "/local-updates", JSON.stringify(home));
await b.ev(`[...document.querySelectorAll('main a')].find(e=>/^See all local updates$/.test(e.innerText.trim())).click()`); await b.sleep(3500);
check("Strip link opens the page", (await b.ev(`location.pathname`)) === "/local-updates");
b.close();

const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
if (failed.length) process.exitCode = 1;
