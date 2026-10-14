import { launch } from "./cdp.mjs";
const SHOT = new URL("../screenshots", import.meta.url).pathname;
const b = await launch();
const out = {};
try {
  await b.viewport(360, 740);
  await b.goto("https://dev.verifiednepal.com/", 5000);
  out.lang360 = await b.ev("document.documentElement.lang");
  out.h1 = await b.ev("document.querySelector('h1')?.innerText");
  out.dateline = await b.ev("document.querySelector('section p.text-xs')?.innerText");
  out.heroButtons = await b.ev("[...document.querySelectorAll('section button')].filter(x=>/सहयोग माग्नुहोस्|सहयोग गर्नुहोस्|Request help|Offer help/.test(x.innerText)).slice(0,3).map(x=>({t:x.innerText.trim(),bottom:Math.round(x.getBoundingClientRect().bottom),h:Math.round(x.getBoundingClientRect().height)}))");
  out.explicitNameSearch = await b.ev("/explicit name search|नाम खोजी/.test(document.body.innerText)");
  out.situationSource = await b.ev("[...document.querySelectorAll('#current-situation span')].map(x=>x.innerText).find(t=>/NDRRMA|एनडीआरआरएमए|स्रोत|Source/.test(t))");
  out.trishuliHardwired = await b.ev("(document.body.innerText.match(/Trishuli|त्रिशूली/g)||[]).length");
  await b.shot(SHOT + "/w1-home-360-ne.png");
  // menu
  const menu = await b.ev("(()=>{const bt=document.querySelector('button[aria-label]:has(svg.lucide-menu)')||[...document.querySelectorAll('button')].find(x=>x.querySelector('svg.lucide-menu'));const r=bt.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await b.click(menu.x, menu.y); await b.sleep(800);
  out.menuItems = await b.ev("[...document.querySelectorAll('[role=dialog] nav button, [role=dialog] nav summary')].map(x=>x.innerText.trim())");
  await b.shot(SHOT + "/w1-menu-360-ne.png");
  // english
  await b.goto("https://dev.verifiednepal.com/", 1000);
  await b.ev("localStorage.setItem('verifiednepal:language','en')"); await b.reload(4500);
  out.langEn = await b.ev("document.documentElement.lang");
  out.h1En = await b.ev("document.querySelector('h1')?.innerText");
  out.datelineEn = await b.ev("document.querySelector('section p.text-xs')?.innerText");
  await b.shot(SHOT + "/w1-home-360-en.png");
  // desktop
  await b.viewport(1280, 800); await b.reload(4500);
  out.desktopNav = await b.ev("[...document.querySelectorAll('header nav button')].map(x=>x.innerText.trim())");
  out.statusBarLinks = await b.ev("[...document.querySelectorAll('.site-status-bar button')].map(x=>x.innerText.trim())");
  await b.shot(SHOT + "/w1-home-1280-en.png");
  // articles signed out
  await b.goto("https://dev.verifiednepal.com/articles", 4000);
  out.writeButtonSignedOut = await b.ev("/Write an article|Write/.test([...document.querySelectorAll('main button')].map(x=>x.innerText).join('|'))");
  // search lead
  await b.goto("https://dev.verifiednepal.com/search", 4000);
  out.searchLead = await b.ev("[...document.querySelectorAll('main p')].slice(0,3).map(x=>x.innerText)");
  // service worker precache
  out.sw = await b.ev("(async()=>{const names=await caches.keys();const res={};for(const n of names){const c=await caches.open(n);res[n]=(await c.keys()).map(r=>new URL(r.url).pathname).filter(p=>/rescued-persons|climate/.test(p));}return res})()");
} catch (e) { out.error = String(e); }
console.log(JSON.stringify(out, null, 1));
b.close();
