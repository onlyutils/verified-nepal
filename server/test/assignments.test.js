import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { createToken, basePayload, FakeDdb, makeEvent, makeKeyPair } from "./helpers.js";

const date = new Date().toISOString().slice(0, 10);

function setup() {
  const kp = makeKeyPair();
  const ddb = new FakeDdb();
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" };
  const handler = createHandler({ env, ddbClient: ddb, fetchJwks: async () => ({ keys: [kp.jwk] }) });
  ddb.store.set("ORG#org-1|META", {
    PK: "ORG#org-1", SK: "META", type: "ORG", id: "org-1", name: "Relief Org", status: "verified",
  });
  for (const [sub, role, name] of [["owner", "owner", "Owner One"], ["staff", "staff", "Staff One"], ["other", "helper", "Other User"]]) {
    ddb.store.set(`ORG#org-1|MEMBER#${sub}`, {
      PK: "ORG#org-1", SK: `MEMBER#${sub}`, type: "ORGMEMBER", orgId: "org-1", sub, role, name,
    });
    ddb.store.set(`USER#${sub}|ORG#org-1`, {
      PK: `USER#${sub}`, SK: "ORG#org-1", type: "ORGMEMBER", orgId: "org-1", sub, role, name,
    });
    ddb.store.set(`USER#${sub}|PROFILE`, {
      PK: `USER#${sub}`, SK: "PROFILE", type: "USER", sub, role, name,
    });
  }
  return { handler, ddb, kp };
}

function authHeaders(kp, sub) {
  return { authorization: `Bearer ${createToken(basePayload({ sub, name: sub }), kp.privateKey)}` };
}

function event(method, path, kp, sub, body, queryStringParameters) {
  return makeEvent({ method, path, body, queryStringParameters, headers: authHeaders(kp, sub) });
}

function body(response) {
  return JSON.parse(response.body);
}

function assignmentBody(overrides = {}) {
  return {
    shiftDate: date,
    shift: "day",
    assigneeSub: "staff",
    siteLabel: "North camp",
    task: "Check the shelter stock and report shortages",
    ...overrides,
  };
}

describe("staff assignments and shift handover", () => {
  beforeEach(() => clearJwksCache());

  it("requires an org member to create an assignment and requires a member assignee", async () => {
    const { handler, kp } = setup();
    let response = await handler(event("POST", "/orgs/org-1/assignments", kp, "other", assignmentBody()));
    assert.equal(response.statusCode, 403);
    response = await handler(event("POST", "/orgs/org-1/assignments", kp, "owner", assignmentBody({ assigneeSub: "other" })));
    assert.equal(response.statusCode, 400);
    response = await handler(event("POST", "/orgs/org-1/assignments", kp, "owner", assignmentBody()));
    assert.equal(response.statusCode, 201, response.body);
  });

  it("allows only the owner or assignee to move status along the ladder", async () => {
    const { handler, kp } = setup();
    const created = body(await handler(event("POST", "/orgs/org-1/assignments", kp, "owner", assignmentBody())));
    let response = await handler(event("POST", `/orgs/org-1/assignments/${created.id}/status`, kp, "other", { status: "on_site" }));
    assert.equal(response.statusCode, 403);
    response = await handler(event("POST", `/orgs/org-1/assignments/${created.id}/status`, kp, "staff", { status: "en_route" }));
    assert.equal(response.statusCode, 200);
    response = await handler(event("POST", `/orgs/org-1/assignments/${created.id}/status`, kp, "staff", { status: "on_site" }));
    assert.equal(response.statusCode, 200);
    response = await handler(event("POST", `/orgs/org-1/assignments/${created.id}/status`, kp, "staff", { status: "en_route" }));
    assert.equal(response.statusCode, 400);
    response = await handler(event("POST", `/orgs/org-1/assignments/${created.id}/status`, kp, "staff", { status: "cancelled" }));
    assert.equal(response.statusCode, 200);
  });

  it("groups handover assignments and includes only log lines from that day", async () => {
    const { handler, kp, ddb } = setup();
    const created = body(await handler(event("POST", "/orgs/org-1/assignments", kp, "owner", assignmentBody())));
    await handler(event("POST", `/orgs/org-1/assignments/${created.id}/status`, kp, "staff", { status: "on_site" }));
    await handler(event("POST", "/orgs/org-1/log", kp, "owner", { text: "Truck left the warehouse" }));
    const yesterday = new Date(`${date}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayIso = `${yesterday.toISOString().slice(0, 10)}T12:00:00.000Z`;
    ddb.store.set(`ORG#org-1|LOG#${yesterdayIso}#abcdef`, {
      PK: "ORG#org-1", SK: `LOG#${yesterdayIso}#abcdef`, type: "ACTIVITY", orgId: "org-1",
      at: yesterdayIso, bySub: "owner", byName: "Owner One", text: "Yesterday's note",
    });
    const response = await handler(event("GET", "/orgs/org-1/handover", kp, "staff", undefined, { date, shift: "day" }));
    assert.equal(response.statusCode, 200, response.body);
    const result = body(response);
    assert.equal(result.orgName, "Relief Org");
    assert.equal(result.assignments.length, 1);
    assert.equal(result.assignments[0].assigneeSub, "staff");
    assert.equal(result.assignments[0].assignments[0].status, "on_site");
    assert.equal(result.log.length, 2);
    assert.ok(result.log.every((line) => line.at.startsWith(date)));
    assert.match(result.log[0].text, /on site|Truck/);
  });
});
