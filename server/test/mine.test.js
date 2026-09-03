import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

function setup() {
  const kp = makeKeyPair();
  const ddb = new FakeDdb();
  const handler = createHandler({ env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks: async () => ({ keys: [kp.jwk] }) });
  const token = (sub) => createToken(basePayload({ sub }), kp.privateKey);
  return { handler, ddb, token };
}
const needBody = {
  onBehalf: false,
  beneficiary: { name: "Rita Gurung", district: "Rasuwa", ward: 5, phone: "+9779800000001" },
  category: "goods",
  description: "Need description long enough for the dashboard tests",
  language: "en",
};

describe("ownership pointers and dashboard", () => {
  beforeEach(() => clearJwksCache());

  it("POST /needs with a bearer token writes a pointer, without one it does not", async () => {
    const { handler, ddb, token } = setup();
    let res = await handler(makeEvent({ method: "POST", path: "/needs", body: needBody, headers: { authorization: `Bearer ${token("u1")}` } }));
    assert.equal(res.statusCode, 201);
    const { id } = JSON.parse(res.body);
    const ptr = ddb.store.get(`USER#u1|NEED#${id}`);
    assert.ok(ptr);
    assert.equal(ptr.type, "MINE");
    const need = ddb.store.get(`NEED#${id}|META`);
    assert.equal(need.createdBy, undefined, "need must not carry the account");
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: needBody }));
    assert.equal(res.statusCode, 201);
    const anon = JSON.parse(res.body);
    assert.equal([...ddb.store.keys()].some((k) => k.endsWith(`NEED#${anon.id}`) && k.startsWith("USER#")), false);
  });

  it("POST /me/needs/claim attaches an anonymous need by refCode, idempotently", async () => {
    const { handler, ddb, token } = setup();
    const created = JSON.parse((await handler(makeEvent({ method: "POST", path: "/needs", body: needBody }))).body);
    const claim = () => handler(makeEvent({ method: "POST", path: "/me/needs/claim", body: { refCode: created.refCode }, headers: { authorization: `Bearer ${token("u2")}` } }));
    let res = await claim();
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).id, created.id);
    res = await claim();
    assert.equal(res.statusCode, 200);
    assert.ok(ddb.store.get(`USER#u2|NEED#${created.id}`));
    res = await handler(makeEvent({ method: "POST", path: "/me/needs/claim", body: { refCode: "NOPE" }, headers: { authorization: `Bearer ${token("u2")}` } }));
    assert.equal(res.statusCode, 404);
    res = await handler(makeEvent({ method: "POST", path: "/me/needs/claim", body: { refCode: created.refCode } }));
    assert.equal(res.statusCode, 401);
  });

  it("GET /me/dashboard lists only the caller's needs and offers, newest first, skipping deleted items", async () => {
    const { handler, ddb, token } = setup();
    const auth = { authorization: `Bearer ${token("u3")}` };
    const n1 = JSON.parse((await handler(makeEvent({ method: "POST", path: "/needs", body: needBody, headers: auth }))).body);
    const n2 = JSON.parse((await handler(makeEvent({ method: "POST", path: "/needs", body: needBody, headers: auth }))).body);
    await handler(makeEvent({ method: "POST", path: "/needs", body: needBody, headers: { authorization: `Bearer ${token("someone-else")}` } }));
    const offerRes = await handler(makeEvent({ method: "POST", path: "/offers", body: { categories: ["goods"], districts: ["Rasuwa"], description: "Can bring rice and tarpaulins", phone: "+9779800000002" }, headers: auth }));
    assert.equal(offerRes.statusCode, 201);
    ddb.store.delete(`NEED#${n1.id}|META`);
    const res = await handler(makeEvent({ method: "GET", path: "/me/dashboard", headers: auth }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(body.needs.map((n) => n.id), [n2.id]);
    assert.equal(body.needs[0].refCode, n2.refCode);
    assert.equal(body.needs[0].status, "pending");
    assert.equal(body.needs[0].beneficiary, undefined, "dashboard view must not leak contact fields");
    assert.equal(body.offers.length, 1);
    assert.deepEqual(body.offers[0].categories, ["goods"]);
    assert.deepEqual(body.missing, []);
    const anon = await handler(makeEvent({ method: "GET", path: "/me/dashboard" }));
    assert.equal(anon.statusCode, 401);
  });
});
