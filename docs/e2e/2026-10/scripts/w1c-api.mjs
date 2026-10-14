const API = "https://api.dev.verifiednepal.com";
const results = [];
const rec = (id, name, ok, detail = "") => { results.push({ id, name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${name}  ${detail}`); };
async function login(email) {
  const r = await fetch("https://auth.onlyutils.com/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "E2eTest!2026Pass", client_id: "ou_client_34HIKupJ5afWl0DIoh7zi" }) });
  return (await r.json()).access_token;
}
async function call(token, method, path, body) {
  const r = await fetch(API + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
const T = {};
for (const n of ["admin", "moderator", "helper", "helper-01", "helper-02"]) T[n] = await login(`${n}-beta-tester@verifiednepal.com`);
const sub01 = (await call(T["helper-01"], "GET", "/me")).json.sub;
const happenedAt = "2026-10-14T09:29:00.000Z";
const loc = { district: "Rasuwa", municipalityId: 29001 };
const para = (text) => [{ type: "paragraph", text }];
const full = (extra = {}) => ({ language: "ne", kind: "news", title: "स्थानीय अपडेट शीर्षक", blocks: para("छोटो विवरण यहाँ छ।"), tags: ["floods"], scope: "municipality", locality: loc, happenedAt, sourceUrls: ["https://nepal.gov.np"], displayName: "Sunita Tamang", place: "Rasuwa", ...extra });
const bodyHealth = "राष्ट्रिय पोर्टलले रसुवा भोटेकोशी बाढीको स्वास्थ्य क्षेत्रको प्रतिकार्यसम्बन्धी अद्यावधिक २०८३ असोज २७ गते प्रकाशित गरेको छ। विवरण पूरा पढ्न तलको स्रोत लिङ्क हेर्नुहोस्।";
const bodyGorkha = "राष्ट्रिय पोर्टलले गोरखा-बुढीगण्डकी आकस्मिक बाढीको स्वास्थ्य क्षेत्रको प्रतिकार्यसम्बन्धी अद्यावधिक २०८३ असोज २६ गते प्रकाशित गरेको छ।";

// 0. onboarding
let r = await call(T.admin, "POST", `/admin/users/${sub01}/role`, { reporter: { localities: [], nationalScope: false } });
rec("0a", "admin onboards helper-01 as correspondent", r.status === 200 && !!r.json.reporter?.approvedAt, `status ${r.status}`);
r = await call(T["helper-01"], "GET", "/me");
rec("0b", "helper-01 /me shows reporter.approvedAt", !!r.json.reporter?.approvedAt);
r = await call(T["helper-02"], "POST", "/me/articles", { language: "ne", kind: "news" });
rec("0c", "helper-02 (no flag) cannot create news", r.status === 403 && r.json.error === "reporter_required", `${r.status} ${r.json?.error}`);
r = await call(T.moderator, "POST", `/admin/users/${sub01}/role`, { reporter: null });
rec("0d", "moderator cannot change correspondent flag", r.status === 403, `status ${r.status}`);

// correspondent writes a real, cited local update
r = await call(T["helper-01"], "POST", "/me/articles", full({ title: "रसुवा भोटेकोशी बाढी: स्वास्थ्य क्षेत्रको प्रतिकार्य अद्यावधिक", blocks: para(bodyHealth) }));
const idA = r.json.id; rec("0e", "helper-01 creates news draft", r.status === 201 && !!idA, `${r.status} ${idA}`);
r = await call(T["helper-01"], "PUT", `/me/articles/${idA}`, { title: "रसुवा भोटेकोशी बाढी: स्वास्थ्य क्षेत्रको प्रतिकार्य अद्यावधिक" });
rec("0f", "helper-01 can edit own draft", r.status === 200, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
r = await call(T["helper-01"], "POST", `/me/articles/${idA}/submit`);
rec("0g", "helper-01 submits → pending", r.status === 200 && r.json.status === "pending", `${r.status} ${JSON.stringify(r.json)}`);
r = await call(T["helper-01"], "POST", `/moderation/dispatches/${idA}`, { action: "publish" });
rec("0h", "helper-01 cannot moderate (not moderator)", r.status === 403, `status ${r.status}`);

// 1-2 admin authored; admin cannot publish own
r = await call(T.admin, "POST", "/me/articles", full({ title: "गोरखा-बुढीगण्डकी आकस्मिक बाढी: स्वास्थ्य क्षेत्रको प्रतिकार्य अद्यावधिक", blocks: para(bodyGorkha), scope: "district", locality: { district: "Gorkha", municipalityId: 36007 }, happenedAt: "2026-10-13T04:17:00.000Z", sourceUrls: undefined, sourceNote: "राष्ट्रिय पोर्टल (nepal.gov.np), २०८३ असोज २६", displayName: "Admin Desk", place: "Gorkha" }));
const idB = r.json.id; rec("1a", "admin creates news draft", r.status === 201, `${r.status} ${idB}`);
r = await call(T.admin, "GET", `/me/articles/${idB}`);
rec("1b", "admin news with only a typed source line (no URL) accepted", r.status === 200 && !!r.json.sourceNote && !(r.json.sourceUrls||[]).length, `${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);

r = await call(T.admin, "POST", `/me/articles/${idB}/submit`);
rec("1c", "admin submits → pending", r.status === 200 && r.json.status === "pending", `${r.status} ${JSON.stringify(r.json)}`);
r = await call(T.admin, "POST", `/moderation/dispatches/${idB}`, { action: "publish" });
rec("2", "admin cannot publish own news (own_item)", r.status === 403 && /own_item/.test(JSON.stringify(r.json)), `${r.status} ${JSON.stringify(r.json)}`);

// 3. moderator publishes both; lists
r = await call(T.moderator, "GET", "/moderation/dispatches?kind=news");
rec("3a", "moderator queue ?kind=news lists both pending", r.status === 200 && [idA, idB].every((i) => r.json.items.some((x) => x.id === i)), `${r.status} ${r.json.items?.length} items`);
r = await call(T.moderator, "GET", "/moderation/dispatches");
rec("3b", "moderator default queue excludes news", r.status === 200 && ![idA, idB].some((i) => r.json.items.some((x) => x.id === i)));
for (const [id, tag] of [[idA, "A"], [idB, "B"]]) { r = await call(T.moderator, "POST", `/moderation/dispatches/${id}`, { action: "publish" }); rec(`3c${tag}`, `moderator publishes ${tag}`, r.status === 200, `${r.status} ${JSON.stringify(r.json)}`); }
r = await call(null, "GET", "/dispatches?kind=news");
rec("3d", "GET /dispatches?kind=news lists both", r.status === 200 && [idA, idB].every((i) => r.json.items.some((x) => x.id === i)), `${r.json.items?.length} items`);
r = await call(null, "GET", "/dispatches");
rec("3e", "GET /dispatches (no kind) excludes news", r.status === 200 && ![idA, idB].some((i) => r.json.items.some((x) => x.id === i)), `${r.json.items?.length} items`);
r = await call(null, "GET", `/dispatches/${idA}`);
rec("3f", "detail shows kind, locality, happenedAt, sourceUrls", r.status === 200 && r.json.kind === "news" && r.json.locality?.municipalityId === 29001 && !!r.json.happenedAt && r.json.sourceUrls?.length === 1, JSON.stringify({ kind: r.json.kind, locality: r.json.locality, happenedAt: r.json.happenedAt, sourceUrls: r.json.sourceUrls }));
r = await call(null, "GET", `/dispatches/${idB}`);
rec("3g", "detail of typed-source item shows sourceNote, no URL needed", r.status === 200 && !!r.json.sourceNote && !(r.json.sourceUrls?.length), JSON.stringify({ sourceNote: r.json.sourceNote, sourceUrls: r.json.sourceUrls }));
const leak = JSON.stringify((await call(null, "GET", `/dispatches/${idA}`)).json);
rec("3h", "public detail leaks no email or raw sub", !/@|"sub"|authorSub/.test(leak));

// 4. validation, as admin (exempt from daily limit); drafts deleted after
async function submitCase(name, patch, expectMissing) {
  const c = await call(T.admin, "POST", "/me/articles", full(patch));
  const rejected = c.status === 400 && (!expectMissing || JSON.stringify(c.json).includes(expectMissing));
  rec("4", name, rejected, `${c.status} ${JSON.stringify(c.json).slice(0, 140)}`);
  if (c.status === 201) await call(T.admin, "DELETE", `/me/articles/${c.json.id}`);
}
await submitCase("body over 1200 chars → 400", { blocks: para("क".repeat(1250)) }, "body");
await submitCase("no happenedAt → 400 missing", { happenedAt: undefined }, "happenedAt");
await submitCase("no source URL and no note → 400 missing source", { sourceUrls: [] }, "source");

// 5. article flow unchanged
const art = await call(T.helper, "POST", "/me/articles", { language: "en" });
await call(T.helper, "PUT", `/me/articles/${art.json.id}`, { title: "Notes from a relief shift", blocks: para("A short account of a Saturday shift at the drop centre, written the same evening."), cover: { url: "https://dev.verifiednepal.com/og-card.png", fileId: "cover-1", source: "Photo: Pratik Gurung" }, tags: ["community"], displayName: "Pratik Gurung", place: "Kathmandu" });
r = await call(T.helper, "POST", `/me/articles/${art.json.id}/submit`);
rec("5a", "helper article submit → pending", r.status === 200 && r.json.status === "pending", `${r.status}`);
r = await call(T.moderator, "GET", "/moderation/dispatches");
rec("5b", "default moderation queue shows the article", r.json.items?.some((x) => x.id === art.json.id));
r = await call(T.moderator, "POST", `/moderation/dispatches/${art.json.id}`, { action: "reject", reason: "Needs a clearer place and date" });
rec("5c", "moderator can reject the article with a reason", r.status === 200, `${r.status}`);
await call(T.helper, "DELETE", `/me/articles/${art.json.id}`);

// 7. daily limit setting
r = await call(T.admin, "GET", "/admin/settings/local-updates");
rec("7a", "settings default readable by admin", r.status === 200 && typeof r.json.dailyLimit === "number", JSON.stringify(r.json));
const original = r.json;
r = await call(T.moderator, "PUT", "/admin/settings/local-updates", { dailyLimitEnabled: true, dailyLimit: 1 });
rec("7b", "moderator cannot change the setting", r.status === 403, `${r.status}`);
r = await call(T.admin, "PUT", "/admin/settings/local-updates", { dailyLimitEnabled: true, dailyLimit: 1 });
rec("7c", "admin sets limit on, 1/day", r.status === 200, `${r.status} ${JSON.stringify(r.json)}`);
r = await call(T["helper-01"], "POST", "/me/articles", full());
rec("7d", "helper-01 (already filed one today) is blocked → 429 daily_limit", r.status === 429 && r.json.error === "daily_limit", `${r.status} ${JSON.stringify(r.json)}`);
r = await call(T.admin, "PUT", "/admin/settings/local-updates", { dailyLimitEnabled: false, dailyLimit: 1 });
r = await call(T["helper-01"], "POST", "/me/articles", full());
rec("7e", "limit switched off → helper-01 can create again", r.status === 201, `${r.status}`);
if (r.json?.id) await call(T["helper-01"], "DELETE", `/me/articles/${r.json.id}`);
r = await call(T.admin, "PUT", "/admin/settings/local-updates", { dailyLimitEnabled: original.dailyLimitEnabled, dailyLimit: original.dailyLimit });
rec("7f", "setting restored to default", r.status === 200 && r.json.dailyLimit === original.dailyLimit, JSON.stringify(r.json));
r = await call(T.admin, "PUT", "/admin/settings/local-updates", { dailyLimitEnabled: true, dailyLimit: 0 });
rec("7g", "limit 0 rejected", r.status === 400, `${r.status}`);

import { writeFileSync } from "node:fs";
writeFileSync(new URL("./w1c-state.json", import.meta.url), JSON.stringify({ idA, idB, sub01, results }, null, 1));
console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed; items: ${idA} ${idB}`);
