import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeDdb } from "./helpers.js";
import { expireTakes } from "../src/tasks/expireTakes.js";
import { createHandler } from "../src/index.js";

function matched(ddb, id, handledBy, at) {
  const need = { PK: `NEED#${id}`, SK: "META", type: "NEED", id, status: "matched", category: "goods", incidentId: "general", createdAt: at,
    beneficiary: { name: "Ram Tamang", district: "Rasuwa", ward: 1 }, handledBy: handledBy ? { ...handledBy, at } : undefined,
    gsi1pk: "NEED#general#Rasuwa#matched", gsi1sk: at, gsi2pk: "NEED#matched", gsi2sk: at };
  if (!need.handledBy) delete need.handledBy;
  ddb.store.set(`${need.PK}|${need.SK}`, need);
  return need;
}

test("releases takes older than 6 days, leaves fresh takes and moderator matches alone", async () => {
  const ddb = new FakeDdb();
  const now = new Date("2026-09-10T00:00:00.000Z");
  matched(ddb, "old-helper", { kind: "helper", sub: "u1", label: "Sita K." }, "2026-09-01T00:00:00.000Z");
  ddb.store.set("USER#u1|HANDLING#old-helper", { PK: "USER#u1", SK: "HANDLING#old-helper" });
  matched(ddb, "old-org", { orgId: "o1", orgName: "Red Cross", bySub: "u2" }, "2026-09-02T00:00:00.000Z");
  ddb.store.set("ORG#o1|NEED#old-org", { PK: "ORG#o1", SK: "NEED#old-org" });
  matched(ddb, "fresh", { kind: "helper", sub: "u3", label: "Hari B." }, "2026-09-08T00:00:00.000Z");
  const mod = matched(ddb, "mod-match", undefined, "2026-08-01T00:00:00.000Z"); mod.matchedOfferId = "off1";

  const result = await expireTakes(ddb, "t", { now });
  assert.deepEqual(result.expired.sort(), ["old-helper", "old-org"]);
  assert.equal(ddb.store.get("NEED#old-helper|META").status, "published");
  assert.equal(ddb.store.get("NEED#old-helper|META").handledBy, undefined);
  assert.equal(ddb.store.get("NEED#old-helper|META").events.at(-1).event, "expired");
  assert.equal(ddb.store.get("USER#u1|HANDLING#old-helper"), undefined);
  assert.equal(ddb.store.get("ORG#o1|NEED#old-org"), undefined);
  assert.equal(ddb.store.get("NEED#fresh|META").status, "matched");
  assert.equal(ddb.store.get("NEED#mod-match|META").status, "matched");
  const audits = [...ddb.store.values()].filter((i) => i.type === "AUDIT" && i.action === "take_expired");
  assert.equal(audits.length, 2);
  assert.equal(audits[0].actorSub, "system");
  // idempotent
  assert.deepEqual((await expireTakes(ddb, "t", { now })).expired, []);
});

test("lambda entry routes the scheduled task", async () => {
  const ddb = new FakeDdb();
  const handler = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: ddb });
  const res = await handler({ task: "expire-takes" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { scanned: 0, expired: [] });
  const bad = await handler({ task: "nope" });
  assert.equal(bad.statusCode, 400);
});
