import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { maskName } from "../src/lib/format.js";
import { toPublicAuditLine } from "../src/views/audit.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent, seedActiveIncident } from "./helpers.js";

function makeHandler(opts = {}) {
  const kp = opts.kp ?? makeKeyPair();
  const ddb = opts.ddb ?? new FakeDdb();
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table" };
  const handler = createHandler({ env, ddbClient: ddb, fetchJwks: async () => ({ keys: [kp.jwk] }) });
  return { handler, ddb, kp };
}

describe("batch 1 backend fixes", () => {
  beforeEach(() => clearJwksCache());

  it("public incidents allow only active or explicitly requested archived items and strip internal fields", async () => {
    const { handler, ddb } = makeHandler();
    seedActiveIncident(ddb, {
      createdBy: "reporter-1", approvedBy: "moderator-1", proofMedia: [{ originalUrl: "https://private.example/proof.jpg" }],
      rejectedBy: "moderator-2", rejectionReason: "private reason", actorSub: "private-actor",
    });
    seedActiveIncident(ddb, { id: "old-incident", status: "archived", gsi1pk: "INCIDENT#archived", createdAt: "2025-12-01T00:00:00.000Z" });
    seedActiveIncident(ddb, { id: "pending-incident", status: "pending", gsi1pk: "INCIDENT#pending" });

    let res = await handler(makeEvent({ method: "GET", path: "/incidents" }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(body.items.map((item) => item.id), ["test-incident"]);
    for (const field of ["createdBy", "approvedBy", "rejectedBy", "rejectionReason", "proofMedia", "actorSub"]) {
      assert.equal(field in body.items[0], false, field);
    }

    res = await handler(makeEvent({ method: "GET", path: "/incidents", queryStringParameters: { status: "pending" } }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "GET", path: "/incidents", queryStringParameters: { status: "archived" } }));
    assert.deepEqual(JSON.parse(res.body).items.map((item) => item.id), ["old-incident"]);
  });

  it("masks names by words, including punctuation and Devanagari graphemes", () => {
    assert.equal(maskName("Ram Bahadur Karki"), "Ram B. K.");
    assert.equal(maskName("Beta Tester (Helper)"), "Beta T. H.");
    assert.equal(maskName("सीता तामाङ"), "सीता ता.");
    assert.equal(maskName("Madonna"), "Madonna");
    const audit = toPublicAuditLine({ actorName: "Sita Karki", action: "org.create", targetType: "ORG", targetLabel: "Helping Hands" });
    assert.deepEqual(audit, {
      ts: undefined, actorName: "Sita K.", action: "org.create", targetType: "ORG", targetLabel: "Helping Hands",
    });
  });

  it("rejects unknown districts when assigning an admin role", async () => {
    const { handler, ddb, kp } = makeHandler();
    ddb.store.set("USER#admin-1|PROFILE", { PK: "USER#admin-1", SK: "PROFILE", sub: "admin-1", role: "admin", name: "Admin", districts: [] });
    ddb.store.set("USER#user-1|PROFILE", { PK: "USER#user-1", SK: "PROFILE", sub: "user-1", role: "helper", districts: [] });
    const token = createToken(basePayload({ sub: "admin-1" }), kp.privateKey);
    const res = await handler(makeEvent({
      method: "POST", path: "/admin/users/user-1/role", headers: { authorization: `Bearer ${token}` },
      body: { role: "moderator", districts: ["Gorkha", "Atlantis"] },
    }));
    assert.equal(res.statusCode, 400);
    assert.equal(ddb.store.get("USER#user-1|PROFILE").role, "helper");
  });
});
