import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeDdb } from "./helpers.js";
import { configureSms, sendSms } from "../src/lib/sms.js";
import { notifyRequester } from "../src/lib/notify.js";

function seedNeed(ddb, overrides = {}) {
  const need = {
    PK: "NEED#sms-test",
    SK: "META",
    type: "NEED",
    id: "sms-test",
    refCode: "SMSREF1",
    beneficiary: { name: "Ram Tamang", phone: "9812345678" },
    ...overrides,
  };
  ddb.store.set(`${need.PK}|${need.SK}`, need);
  return need;
}

test("not configured skips SMS and still writes the event", async () => {
  const ddb = new FakeDdb();
  const need = seedNeed(ddb);
  configureSms({}, async () => { throw new Error("should not fetch"); });

  await notifyRequester(ddb, "t", need, "taken", { label: "Sita K." });

  const stored = ddb.store.get("NEED#sms-test|META");
  assert.equal(stored.events.length, 1);
  assert.equal(stored.events[0].event, "taken");
  assert.equal(stored.events[0].smsSentAt, undefined);
});

test("configured SMS posts the Sparrow body and records smsSentAt", async () => {
  const ddb = new FakeDdb();
  const need = seedNeed(ddb);
  const requests = [];
  configureSms({ SPARROW_TOKEN: "token-1", SPARROW_FROM: "VerifiedNP", PUBLIC_SITE_BASE: "https://status.example" }, async (url, init) => {
    requests.push({ url, init });
    return { ok: true, status: 200 };
  });

  await notifyRequester(ddb, "t", need, "delivered", { label: "Sita Kumari" });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.sparrowsms.com/v2/sms/");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    token: "token-1",
    from: "VerifiedNP",
    to: "9812345678",
    text: "Your request was delivered by Sita K. / तपाईंको अनुरोध Sita K. ले पुर्‍याउनुभएको छ। Status: https://status.example/status/SMSREF1 स्थिति: https://status.example/status/SMSREF1",
  });
  assert.equal(ddb.store.get("NEED#sms-test|META").events[0].smsSentAt !== undefined, true);
});

test("invalid Nepal number is skipped", async () => {
  const fetchImpl = async () => { throw new Error("should not fetch"); };
  configureSms({ SPARROW_TOKEN: "token-1" }, fetchImpl);

  assert.deepEqual(await sendSms({ to: "1234567890", text: "hello" }), { sent: false, skipped: "bad_number" });
});
