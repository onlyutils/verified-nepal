import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeDdb } from "./helpers.js";
import { fulfilNeed } from "../src/models/claim.js";
import { validateDeliveryReceipt } from "../src/lib/validate.js";
import { toLedgerItem, toLedgerCsv } from "../src/views/ledger.js";
import { toStatusView } from "../src/views/need.js";

const photo = { fileId: "f1", type: "photo", originalUrl: "https://cdn/x.jpg" };

test("validateDeliveryReceipt", () => {
  assert.equal(validateDeliveryReceipt({}), undefined);
  assert.deepEqual(validateDeliveryReceipt({ households: 3 }), { households: 3 });
  assert.throws(() => validateDeliveryReceipt({ households: 0 }), /households/);
  assert.throws(() => validateDeliveryReceipt({ lat: 27 }), /lat and lng/);
  assert.throws(() => validateDeliveryReceipt({ photo: { ...photo, type: "video" } }), /photo/);
  assert.deepEqual(validateDeliveryReceipt({ photo, lat: 28.1, lng: 85.3 }), { photo, lat: 28.1, lng: 85.3 });
});

test("fulfilNeed stores the receipt privately and households publicly", async () => {
  const ddb = new FakeDdb();
  const need = { PK: "NEED#n1", SK: "META", type: "NEED", id: "n1", status: "matched", category: "goods", incidentId: "general", createdAt: "2026-09-01T00:00:00.000Z", beneficiary: { name: "Ram Tamang", district: "Rasuwa", ward: 2, municipalityId: 1 }, handledBy: { kind: "helper", sub: "u1", label: "Sita K.", at: "2026-09-02T00:00:00.000Z" } };
  ddb.store.set("NEED#n1|META", structuredClone(need));
  await fulfilNeed(ddb, "t", { need, actorSub: "u1", actorName: "Sita", reason: "helper:Sita K.", deliveredBy: { kind: "helper", label: "Sita K." }, expectedStatus: "matched", receipt: { photo, households: 4, lat: 28.1, lng: 85.3 } });
  const stored = ddb.store.get("NEED#n1|META");
  assert.equal(stored.deliveryReceipt.households, 4);
  assert.ok(stored.deliveryReceipt.at);
  const row = ddb.store.get(`LEDGER#Rasuwa#2|${stored.redeemedAt}#n1`);
  assert.equal(row.households, 4);
  assert.equal(row.hasReceipt, true);
  assert.equal(row.municipalityId, 1);
  assert.equal(row.deliveryReceipt, undefined);
  const item = toLedgerItem(row);
  assert.equal(item.households, 4);
  assert.equal(item.receipt, true);
  assert.equal(JSON.stringify(item).includes("cdn/x.jpg"), false);
  assert.match(toLedgerCsv([item]).split("\n")[0], /households,receipt$/);
  const status = toStatusView(stored, {});
  assert.equal(status.deliveryReceipt.photo.originalUrl, photo.originalUrl);
  assert.equal(status.deliveryReceipt.lat, undefined);
});
