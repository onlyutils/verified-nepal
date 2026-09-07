import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fulfilNeed, performRedeem, validateDeliveredBy } from "../src/models/claim.js";
import { toLedgerCsv, toLedgerItem } from "../src/views/ledger.js";
import { FakeDdb } from "./helpers.js";

function seedClaim(ddb, id, overrides = {}) {
  const need = {
    PK: `NEED#${id}`,
    SK: "META",
    type: "NEED",
    id,
    claimCode: `CODE-${id}`,
    status: "published",
    incidentId: "incident-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    category: "goods",
    beneficiary: { name: "Rita Gurung", district: "Gorkha", ward: 5 },
    ...overrides,
  };
  ddb.store.set(`${need.PK}|${need.SK}`, structuredClone(need));
  ddb.store.set(`CLAIM#${need.claimCode}|META`, { PK: `CLAIM#${need.claimCode}`, SK: "META", needId: id });
  return need;
}

async function redeem(overrides) {
  const ddb = new FakeDdb();
  const need = seedClaim(ddb, "need-1", overrides);
  await performRedeem(ddb, "table", { claimCode: need.claimCode, actorSub: "moderator-1", actorName: "Moderator" });
  return { ddb, need: ddb.store.get(`${need.PK}|${need.SK}`), ledger: ddb.store.get(`LEDGER#Gorkha|2026-01-01T00:00:00.000Z#need-1`) };
}

describe("ledger delivery attribution", () => {
  it("uses the linked offer's masked helper label", async () => {
    const ddb = new FakeDdb();
    const need = seedClaim(ddb, "need-1", { matchedOfferId: "offer-1" });
    ddb.store.set("OFFER#offer-1|META", { PK: "OFFER#offer-1", SK: "META", type: "OFFER", id: "offer-1", helperLabel: "Asha S." });
    await performRedeem(ddb, "table", { claimCode: need.claimCode, actorSub: "moderator-1", actorName: "Moderator" });
    const result = ddb.store.get("NEED#need-1|META");
    assert.deepEqual(result.deliveredBy, { kind: "helper", label: "Asha S.", ref: "offer-1" });
  });

  it("uses the active helper group's member count", async () => {
    const { need } = await redeem({ group: { name: "Help group" }, groupMembers: { a: {}, b: {}, c: {} } });
    assert.deepEqual(need.deliveredBy, { kind: "group", label: "Helper group (3)" });
  });

  it("uses field attribution when no organization, offer, or group is linked", async () => {
    const { need } = await redeem();
    assert.deepEqual(need.deliveredBy, { kind: "field", label: "Claim code · moderator" });
  });

  it("shows the legacy moderator fallback when a ledger row has no deliveredBy", () => {
    const item = toLedgerItem({ maskedName: "Asha S.", category: "goods", district: "Gorkha", ward: 5, redeemedAt: "2026-01-01T00:00:00.000Z" });
    assert.deepEqual(item.deliveredBy, { kind: "field", label: "Claim code · moderator" });
    assert.match(toLedgerCsv([item]), /Claim code · moderator,field,/);
  });

  it("uses organization attribution for an organization delivery", async () => {
    const ddb = new FakeDdb();
    const need = seedClaim(ddb, "org-need", { status: "matched", handledBy: { orgName: "Helping Hands" } });
    await fulfilNeed(ddb, "table", { need, actorSub: "member-1", actorName: "Member", reason: "org:Helping Hands", orgName: "Helping Hands", expectedStatus: "matched" });
    assert.deepEqual(ddb.store.get("NEED#org-need|META").deliveredBy, { kind: "org", label: "Helping Hands" });
  });

  it("validates override kind, length, and PII-free labels", () => {
    assert.deepEqual(validateDeliveredBy({ kind: "helper", label: "Asha S." }, "moderator-1"), { kind: "helper", label: "Asha S." });
    assert.throws(() => validateDeliveredBy({ kind: "unknown", label: "Field" }, "moderator-1"), /kind/);
    assert.throws(() => validateDeliveredBy({ kind: "field", label: "x".repeat(81) }, "moderator-1"), /too long/);
    assert.throws(() => validateDeliveredBy({ kind: "field", label: "call +977-9800000000" }, "moderator-1"), /identifiers/);
    assert.throws(() => validateDeliveredBy({ kind: "field", label: "moderator@example.com" }, "moderator-1"), /identifiers/);
    assert.throws(() => validateDeliveredBy({ kind: "field", label: "moderator-1" }, "moderator-1"), /identifiers/);
  });

  it("includes the delivery attribution in ledger JSON and CSV", () => {
    const item = toLedgerItem({ maskedName: "Asha S.", category: "goods", district: "Gorkha", ward: 5, redeemedAt: "2026-01-01T00:00:00.000Z", deliveredBy: { kind: "helper", label: "Asha S.", ref: "offer-1" } });
    assert.deepEqual(item.deliveredBy, { kind: "helper", label: "Asha S.", ref: "offer-1" });
    const csv = toLedgerCsv([item]);
    assert.match(csv, /^maskedName,category,district,ward,redeemedAt,orgName,deliveredBy,deliveredByKind,deliveredByRef\n/);
    assert.match(csv, /Asha S\.,helper,offer-1/);
  });
});
