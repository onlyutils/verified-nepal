import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

describe("GSI status transition", () => {
  it("fulfilled need appears under fulfilled GSI keys and disappears from published", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const fetchJwks = async () => ({ keys: [kp.jwk] });
    const handler = createHandler({ env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);

    let res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "Gita Karki", district: "Gorkha", ward: 7 }, category: "goods", description: "Need food and shelter for fulfilled GSI test case long enough", language: "en" } }));
    assert.equal(res.statusCode, 201);
    const { id: needId } = JSON.parse(res.body);
    const created = ddb.store.get(`NEED#${needId}|META`);
    const district = created.beneficiary.district;

    res = await handler(makeEvent({ method: "POST", path: `/moderation/${needId}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 200);
    let publishedQuery = await ddb.send(new QueryCommand({ TableName: "t", IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk", ExpressionAttributeValues: { ":pk": "NEED#published" } }));
    assert.ok(publishedQuery.Items.some((it) => it.id === needId), "should be in published GSI2 after publish");
    let gsi1Pub = await ddb.send(new QueryCommand({ TableName: "t", IndexName: "GSI1", KeyConditionExpression: "gsi1pk = :pk", ExpressionAttributeValues: { ":pk": `NEED#${district}#published` } }));
    assert.ok(gsi1Pub.Items.some((it) => it.id === needId), "should be in published GSI1 after publish");

    // transition to matched then fulfilled
    res = await handler(makeEvent({ method: "POST", path: `/needs/${needId}/status`, headers: { authorization: `Bearer ${modTok}` }, body: { status: "matched" } }));
    assert.equal(res.statusCode, 200);
    res = await handler(makeEvent({ method: "POST", path: `/needs/${needId}/status`, headers: { authorization: `Bearer ${modTok}` }, body: { status: "fulfilled" } }));
    assert.equal(res.statusCode, 200);

    const stored = ddb.store.get(`NEED#${needId}|META`);
    assert.equal(stored.status, "fulfilled");
    assert.equal(stored.gsi1pk, `NEED#${district}#fulfilled`);
    assert.equal(stored.gsi2pk, `NEED#fulfilled`);

    // fulfilled should appear under fulfilled GSI
    let fulfilledQuery = await ddb.send(new QueryCommand({ TableName: "t", IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk", ExpressionAttributeValues: { ":pk": "NEED#fulfilled" } }));
    assert.ok(fulfilledQuery.Items.some((it) => it.id === needId), "should be in fulfilled GSI2 after fulfilled");

    let gsi1Ful = await ddb.send(new QueryCommand({ TableName: "t", IndexName: "GSI1", KeyConditionExpression: "gsi1pk = :pk", ExpressionAttributeValues: { ":pk": `NEED#${district}#fulfilled` } }));
    assert.ok(gsi1Ful.Items.some((it) => it.id === needId), "should be in fulfilled GSI1 after fulfilled");

    // should disappear from published
    publishedQuery = await ddb.send(new QueryCommand({ TableName: "t", IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk", ExpressionAttributeValues: { ":pk": "NEED#published" } }));
    assert.equal(publishedQuery.Items.some((it) => it.id === needId), false, "should not be in published GSI2 after fulfilled");

    gsi1Pub = await ddb.send(new QueryCommand({ TableName: "t", IndexName: "GSI1", KeyConditionExpression: "gsi1pk = :pk", ExpressionAttributeValues: { ":pk": `NEED#${district}#published` } }));
    assert.equal(gsi1Pub.Items.some((it) => it.id === needId), false, "should not be in published GSI1 after fulfilled");

    // public board without district should include fulfilled item, and published board should not
    res = await handler(makeEvent({ method: "GET", path: "/needs" }));
    const publicItems = JSON.parse(res.body).items;
    const found = publicItems.find((it) => it.id === needId);
    assert.ok(found, "fulfilled item should be visible on public board");
    assert.equal(found.status, "fulfilled");
  });
});
