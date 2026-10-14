import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DispatchPublicItem } from "./api.ts";
import { deliveryNowItem, localUpdateNowItem, normaliseNowItems, nowEmptyMessage, nowShareText, officialNowItem, sortNowItems, standingNowItems, type NowLedgerItem } from "./now-items.ts";

const NOW = new Date("2026-10-14T12:00:00Z");
const delivery: NowLedgerItem = {
  maskedName: "Sita R.", category: "goods", district: "Rasuwa", municipalityId: 29001, ward: 3,
  redeemedAt: "2026-10-14T09:00:00Z", confirmedAt: "2026-10-14T10:00:00Z",
  orgName: "Relief team", deliveredBy: { kind: "field", label: "Moderator desk" },
};
const update: DispatchPublicItem = {
  id: "local-1", kind: "news", language: "ne", title: { en: "English title", ne: "स्वास्थ्य क्षेत्रको प्रतिकार्य अद्यावधिक" },
  excerpt: "", author: { displayName: "Sunita" }, tags: [], publishedAt: "2026-10-14T11:00:00Z",
  happenedAt: "2026-10-14T01:00:00Z", locality: { district: "Rasuwa", municipalityId: "29001", ward: 3 },
  sourceUrls: ["https://nepal.gov.np"],
};

describe("Now adapters", () => {
  it("relays OPMCM title, agency, createdAt and full description in their written language", () => {
    const item = officialNowItem({ _id: "official-1", title: "स्वास्थ्य क्षेत्रको प्रतिकार्य", agency: "नेपाल सरकार", createdAt: "2026-10-14T10:00:00Z", updatedAt: "2026-10-14T11:00:00Z", description: "पूरा विवरण\nअर्को पङ्क्ति" }, "en");
    assert.equal(item.title, "स्वास्थ्य क्षेत्रको प्रतिकार्य");
    assert.equal(item.place, "नेपाल सरकार");
    assert.equal(item.body, "पूरा विवरण\nअर्को पङ्क्ति");
    assert.equal(item.happenedAt, "2026-10-14T10:00:00Z");
    assert.equal(item.trust, "official");
    assert.equal(item.language, "ne");
    assert.equal(item.href, "https://rescue.opmcm.gov.np/government-efforts");
    assert.equal(item.source.url, item.href);
    assert.equal(officialNowItem({ _id: "en", title: "Relief delivered" }, "ne").language, "en");
  });

  it("labels deliveries with the organization or delivery label, uses confirmedAt and shows no trust word", () => {
    const item = deliveryNowItem(delivery, "en");
    assert.equal(item.title, "Delivered · Relief team");
    assert.equal(item.place, "Gosaikunda · Ward 3");
    assert.equal(item.happenedAt, delivery.confirmedAt);
    assert.equal(item.trust, null);
    assert.equal(item.href, "/ledger");
    const fallback = deliveryNowItem({ ...delivery, municipalityId: undefined, orgName: undefined, confirmedAt: undefined }, "ne");
    assert.equal(fallback.title, "पुर्‍याइयो · Moderator desk");
    assert.equal(fallback.place, "रसुवा · वडा ३");
    assert.equal(fallback.happenedAt, delivery.redeemedAt);
    assert.equal(deliveryNowItem({ ...delivery, orgName: undefined, deliveredBy: undefined }, "en").title, "Delivered · Moderator");
  });

  it("renders Nepali ward digits without relying on browser locale support", (t) => {
    t.mock.method(Intl, "NumberFormat", function () { throw new Error("Unexpected locale formatter"); });
    assert.equal(deliveryNowItem(delivery, "ne").place, "गोसाईकुण्ड · वडा ३");
    assert.equal(localUpdateNowItem(update, "ne").place, "गोसाईकुण्ड · वडा ३");
  });

  it("keeps a local update in its declared language, with locality, event date, source and Checked trust", () => {
    const item = localUpdateNowItem(update, "en");
    assert.equal(item.title, "स्वास्थ्य क्षेत्रको प्रतिकार्य अद्यावधिक");
    assert.equal(item.language, "ne");
    assert.equal(item.place, "Gosaikunda · Ward 3");
    assert.equal(item.happenedAt, update.happenedAt);
    assert.deepEqual(item.source, { label: "nepal.gov.np", url: "https://nepal.gov.np/" });
    assert.equal(item.trust, "checked");
    assert.equal(item.href, "/articles/local-1");
    assert.equal(localUpdateNowItem(update, "ne").title, item.title);
  });

  it("shows sourceNote as plain text or a translated detail link when neither source is supplied", () => {
    assert.deepEqual(localUpdateNowItem({ ...update, sourceUrls: [], sourceNote: "स्थानीय सूचना" }, "en").source, { label: "स्थानीय सूचना", url: null });
    assert.deepEqual(localUpdateNowItem({ ...update, sourceUrls: undefined }, "en").source, { label: "Read the update", url: "/articles/local-1" });
    assert.deepEqual(localUpdateNowItem({ ...update, sourceUrls: ["javascript:alert(1)"], sourceNote: "स्रोत" }, "ne").source, { label: "स्रोत", url: null });
    assert.equal(localUpdateNowItem({ ...update, title: { ne: "नेपाली मात्र" } as DispatchPublicItem["title"] }, "en").title, "नेपाली मात्र");
  });
});

describe("Now feed", () => {
  it("sorts by happenedAt without mutating inputs and excludes invalid dates and standing entries", () => {
    const old = localUpdateNowItem(update, "en");
    const recent = deliveryNowItem(delivery, "en");
    const items = [old, { ...old, id: "invalid", happenedAt: "invalid" }, ...standingNowItems("en"), recent];
    const original = items.slice();
    assert.deepEqual(sortNowItems(items).map((item) => item.id), [recent.id, old.id]);
    assert.deepEqual(items, original);
  });

  it("takes the newest ten from each added source and caps the initial mixed list at ten, leaving standing entries last", () => {
    const ledger = Array.from({ length: 12 }, (_, index) => ({ ...delivery, confirmedAt: new Date(NOW.getTime() - index * 60_000).toISOString() })).reverse();
    const localUpdates = Array.from({ length: 12 }, (_, index) => ({ ...update, id: `local-${index}`, happenedAt: new Date(NOW.getTime() - index * 120_000).toISOString() })).reverse();
    const feed = normaliseNowItems({ official: [{ _id: "official", title: "Official update", createdAt: "2026-10-14T12:01:00Z" }], ledger, localUpdates }, "en");
    assert.equal(feed.visible.length, 10);
    assert.equal(feed.all.length, 21);
    assert.equal(feed.all.filter((item) => item.kind === "delivery").length, 10);
    assert.equal(feed.all.filter((item) => item.kind === "local-update").length, 10);
    assert.equal(feed.latestAt, "2026-10-14T12:01:00Z");
    assert.equal(feed.visible[0].id, "official:official");
    assert.equal(feed.all.some((item) => item.id === "local-update:local-11"), false);
    assert.deepEqual([...feed.visible, ...feed.standing].slice(-2).map((item) => item.kind), ["standing", "standing"]);
    assert.equal(feed.standing.every((item) => item.happenedAt === null), true);
  });

  it("keeps standing entries and a meaningful empty message when every feed is empty", () => {
    const feed = normaliseNowItems({ official: [], ledger: [], localUpdates: [] }, "en");
    assert.deepEqual(feed.visible, []);
    assert.equal(feed.standing.length, 2);
    assert.equal(nowEmptyMessage(feed.latestAt, "en", NOW), "No updates yet");
    assert.equal(nowEmptyMessage("2026-10-14T01:00:00Z", "en", NOW), "Nothing new since 11 hours ago");
    assert.equal(nowEmptyMessage("2026-10-14T01:00:00Z", "ne", NOW), "११ घण्टा पहिले देखि कुनै नयाँ जानकारी छैन");
    assert.equal(nowEmptyMessage("invalid", "ne", NOW), "अहिलेसम्म कुनै जानकारी आएको छैन");
  });

  it("survives unavailable sources and excludes other dispatch kinds", () => {
    const official = [{ _id: "only", title: "Official update", createdAt: "2026-10-14T11:00:00Z" }];
    assert.equal(normaliseNowItems({ official, ledger: [], localUpdates: [] }, "en").visible.length, 1);
    assert.equal(normaliseNowItems({ official: [], ledger: [delivery], localUpdates: [{ ...update, kind: "article" }] }, "en").visible.length, 1);
  });

  it("builds text shares with title, place, Devanagari relative time and an absolute permalink", () => {
    const item = localUpdateNowItem(update, "ne");
    const text = nowShareText(item, "ne", "https://dev.verifiednepal.com", NOW);
    assert.equal(text, "स्वास्थ्य क्षेत्रको प्रतिकार्य अद्यावधिक\nगोसाईकुण्ड · वडा ३\n११ घण्टा पहिले\nhttps://dev.verifiednepal.com/articles/local-1");
    assert.equal(new URL(`viber://forward?text=${encodeURIComponent(text)}`).searchParams.get("text"), text);
  });
});
