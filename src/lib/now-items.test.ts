import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deliveryNowItem, normaliseNowItems, nowEmptyMessage, nowShareText, officialNowItem, sortNowItems, standingNowItems, type NowLedgerItem } from "./now-items.ts";

const NOW = new Date("2026-10-14T12:00:00Z");
const delivery: NowLedgerItem = {
  maskedName: "Sita R.", category: "goods", district: "Rasuwa", municipalityId: 29001, ward: 3,
  redeemedAt: "2026-10-14T09:00:00Z", confirmedAt: "2026-10-14T10:00:00Z",
  orgName: "Relief team", deliveredBy: { kind: "field", label: "Moderator desk" },
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
    assert.equal(item.language, "en");
    const fallback = deliveryNowItem({ ...delivery, municipalityId: undefined, orgName: undefined, confirmedAt: undefined }, "ne");
    assert.equal(fallback.title, "पुर्‍याइयो · Moderator desk");
    assert.equal(fallback.place, "रसुवा · वडा ३");
    assert.equal(fallback.happenedAt, delivery.redeemedAt);
    assert.equal(fallback.language, "ne");
    assert.equal(deliveryNowItem({ ...delivery, orgName: undefined, deliveredBy: undefined }, "en").title, "Delivered · Moderator");
  });

  it("renders Nepali ward digits without relying on browser locale support", (t) => {
    t.mock.method(Intl, "NumberFormat", function () { throw new Error("Unexpected locale formatter"); });
    assert.equal(deliveryNowItem(delivery, "ne").place, "गोसाईकुण्ड · वडा ३");
  });


});

describe("Now feed", () => {
  it("sorts by happenedAt without mutating inputs and excludes invalid dates and standing entries", () => {
    const old = officialNowItem({ _id: "old", title: "Old", createdAt: "2026-10-14T09:00:00Z" }, "en");
    const recent = deliveryNowItem(delivery, "en");
    const items = [old, { ...old, id: "invalid", happenedAt: "invalid" }, ...standingNowItems("en"), recent];
    const original = items.slice();
    assert.deepEqual(sortNowItems(items).map((item) => item.id), [recent.id, old.id]);
    assert.deepEqual(items, original);
  });

  it("takes the newest ten from each added source and caps the initial mixed list at ten, leaving standing entries last", () => {
    const ledger = Array.from({ length: 12 }, (_, index) => ({ ...delivery, confirmedAt: new Date(NOW.getTime() - index * 60_000).toISOString() })).reverse();
    const feed = normaliseNowItems({ official: [{ _id: "official", title: "Official update", createdAt: "2026-10-14T12:01:00Z" }], ledger }, "en");
    assert.equal(feed.visible.length, 10);
    assert.equal(feed.all.length, 11);
    assert.equal(feed.all.filter((item) => item.kind === "delivery").length, 10);
    assert.equal(feed.latestAt, "2026-10-14T12:01:00Z");
    assert.equal(feed.visible[0].id, "official:official");
    assert.deepEqual([...feed.visible, ...feed.standing].slice(-2).map((item) => item.kind), ["standing", "standing"]);
    assert.equal(feed.standing.every((item) => item.happenedAt === null), true);
  });

  it("keeps standing entries and a meaningful empty message when every feed is empty", () => {
    const feed = normaliseNowItems({ official: [], ledger: [] }, "en");
    assert.deepEqual(feed.visible, []);
    assert.equal(feed.standing.length, 2);
    assert.equal(nowEmptyMessage(feed.latestAt, "en", NOW), "No updates yet");
    assert.equal(nowEmptyMessage("2026-10-14T01:00:00Z", "en", NOW), "Nothing new since 11 hours ago");
    assert.equal(nowEmptyMessage("2026-10-14T01:00:00Z", "ne", NOW), "११ घण्टा पहिले देखि कुनै नयाँ जानकारी छैन");
    assert.equal(nowEmptyMessage("invalid", "ne", NOW), "अहिलेसम्म कुनै जानकारी आएको छैन");
  });

  it("keeps official updates and ledger entries from the independent sources", () => {
    const official = [{ _id: "only", title: "Official update", createdAt: "2026-10-14T11:00:00Z" }];
    assert.equal(normaliseNowItems({ official, ledger: [] }, "en").visible.length, 1);
    assert.equal(normaliseNowItems({ official: [], ledger: [delivery] }, "en").visible.length, 1);
  });

  it("builds text shares with title, place, Devanagari relative time and an absolute permalink", () => {
    const item = deliveryNowItem(delivery, "ne");
    const text = nowShareText(item, "ne", "https://dev.verifiednepal.com", NOW);
    assert.equal(text, "पुर्‍याइयो · Relief team\nगोसाईकुण्ड · वडा ३\n२ घण्टा पहिले\nhttps://dev.verifiednepal.com/ledger");
    assert.equal(new URL(`viber://forward?text=${encodeURIComponent(text)}`).searchParams.get("text"), text);
  });
});

