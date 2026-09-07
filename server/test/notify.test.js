import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeDdb } from "./helpers.js";
import { notifyRequester, MAX_EVENTS } from "../src/lib/notify.js";
import { toStatusView } from "../src/views/need.js";

function seedNeed(ddb, id = "n1") {
  const need = { PK: `NEED#${id}`, SK: "META", type: "NEED", id, status: "published", category: "goods", createdAt: "2026-09-01T00:00:00.000Z", beneficiary: { name: "Ram Tamang", district: "Rasuwa", ward: 1 } };
  ddb.store.set(`${need.PK}|${need.SK}`, need);
  return need;
}

test("appends masked events and caps at MAX_EVENTS", async () => {
  const ddb = new FakeDdb();
  const need = seedNeed(ddb);
  await notifyRequester(ddb, "t", need, "taken", { label: "Sita K." });
  let stored = ddb.store.get("NEED#n1|META");
  assert.deepEqual(stored.events.map((e) => [e.event, e.label]), [["taken", "Sita K."]]);
  for (let i = 0; i < MAX_EVENTS + 5; i++) await notifyRequester(ddb, "t", need, "released");
  stored = ddb.store.get("NEED#n1|META");
  assert.equal(stored.events.length, MAX_EVENTS);
  assert.equal(stored.events[MAX_EVENTS - 1].event, "released");
});

test("status view exposes events without PII", () => {
  const need = { status: "matched", category: "goods", createdAt: "2026-09-01T00:00:00.000Z", beneficiary: { district: "Rasuwa" }, events: [{ event: "taken", at: "2026-09-02T00:00:00.000Z", label: "Sita K." }] };
  const view = toStatusView(need, {});
  assert.deepEqual(view.events, need.events);
});

test("never throws when the write fails", async () => {
  const ddb = { send: async () => { throw new Error("boom"); } };
  await notifyRequester(ddb, "t", { PK: "NEED#x", SK: "META" }, "delivered");
});
