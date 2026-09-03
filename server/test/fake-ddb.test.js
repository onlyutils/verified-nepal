import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FakeDdb } from "./helpers.js";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

function put(ddb, item) {
  ddb.store.set(`${item.PK}|${item.SK}`, item);
}

describe("FakeDdb nested UpdateCommand support", () => {
  it("SET on a dotted path creates intermediate maps", async () => {
    const ddb = new FakeDdb();
    put(ddb, { PK: "NEED#1", SK: "META", groupItems: {} });
    await ddb.send(new UpdateCommand({
      TableName: "t",
      Key: { PK: "NEED#1", SK: "META" },
      UpdateExpression: "SET groupItems.#id = :item",
      ExpressionAttributeNames: { "#id": "abc" },
      ExpressionAttributeValues: { ":item": { description: "shelter", status: "open" } },
    }));
    const item = ddb.store.get("NEED#1|META");
    assert.deepEqual(item.groupItems.abc, { description: "shelter", status: "open" });
  });

  it("SET on a leaf of an existing nested map updates only that leaf", async () => {
    const ddb = new FakeDdb();
    put(ddb, { PK: "NEED#1", SK: "META", groupItems: { abc: { description: "shelter", status: "open" } } });
    await ddb.send(new UpdateCommand({
      TableName: "t",
      Key: { PK: "NEED#1", SK: "META" },
      UpdateExpression: "SET groupItems.#id.claimedBy = :sub, groupItems.#id.#st = :claimed",
      ExpressionAttributeNames: { "#id": "abc", "#st": "status" },
      ExpressionAttributeValues: { ":sub": "u1", ":claimed": "claimed" },
    }));
    const item = ddb.store.get("NEED#1|META");
    assert.equal(item.groupItems.abc.claimedBy, "u1");
    assert.equal(item.groupItems.abc.status, "claimed");
    assert.equal(item.groupItems.abc.description, "shelter", "sibling leaf must survive");
  });

  it("REMOVE deletes a nested leaf", async () => {
    const ddb = new FakeDdb();
    put(ddb, { PK: "NEED#1", SK: "META", groupItems: { abc: { claimedBy: "u1", status: "claimed" } } });
    await ddb.send(new UpdateCommand({
      TableName: "t",
      Key: { PK: "NEED#1", SK: "META" },
      UpdateExpression: "REMOVE groupItems.#id.claimedBy SET groupItems.#id.#st = :open",
      ExpressionAttributeNames: { "#id": "abc", "#st": "status" },
      ExpressionAttributeValues: { ":open": "open" },
    }));
    const item = ddb.store.get("NEED#1|META");
    assert.equal(item.groupItems.abc.claimedBy, undefined);
    assert.equal(item.groupItems.abc.status, "open");
  });

  it("if_not_exists in SET preserves an already-set value", async () => {
    const ddb = new FakeDdb();
    put(ddb, { PK: "NEED#1", SK: "META", groupMembers: { u1: { joinedAt: "2020-01-01T00:00:00.000Z" } } });
    await ddb.send(new UpdateCommand({
      TableName: "t",
      Key: { PK: "NEED#1", SK: "META" },
      UpdateExpression: "SET groupMembers.#sub = if_not_exists(groupMembers.#sub, :fresh)",
      ExpressionAttributeNames: { "#sub": "u1" },
      ExpressionAttributeValues: { ":fresh": { joinedAt: "2099-01-01T00:00:00.000Z" } },
    }));
    assert.equal(ddb.store.get("NEED#1|META").groupMembers.u1.joinedAt, "2020-01-01T00:00:00.000Z");
  });

  it("ConditionExpression: single attribute_not_exists blocks a second SET", async () => {
    const ddb = new FakeDdb();
    put(ddb, { PK: "NEED#1", SK: "META", group: { name: "x" } });
    await assert.rejects(
      ddb.send(new UpdateCommand({
        TableName: "t",
        Key: { PK: "NEED#1", SK: "META" },
        UpdateExpression: "SET #grp = :g",
        ConditionExpression: "attribute_not_exists(#grp)",
        ExpressionAttributeNames: { "#grp": "group" },
        ExpressionAttributeValues: { ":g": { name: "y" } },
      })),
      (e) => e.name === "ConditionalCheckFailedException",
    );
  });

  it("ConditionExpression: OR chain passes if either side is true", async () => {
    const ddb = new FakeDdb();
    put(ddb, { PK: "NEED#1", SK: "META", groupItems: { abc: { status: "open" } } });
    await ddb.send(new UpdateCommand({
      TableName: "t",
      Key: { PK: "NEED#1", SK: "META" },
      UpdateExpression: "SET groupItems.#id.claimedBy = :sub",
      ConditionExpression: "attribute_not_exists(groupItems.#id.claimedBy) OR groupItems.#id.claimedBy = :sub",
      ExpressionAttributeNames: { "#id": "abc" },
      ExpressionAttributeValues: { ":sub": "u1" },
    }));
    assert.equal(ddb.store.get("NEED#1|META").groupItems.abc.claimedBy, "u1");
    await assert.rejects(
      ddb.send(new UpdateCommand({
        TableName: "t",
        Key: { PK: "NEED#1", SK: "META" },
        UpdateExpression: "SET groupItems.#id.claimedBy = :sub2",
        ConditionExpression: "attribute_not_exists(groupItems.#id.claimedBy) OR groupItems.#id.claimedBy = :sub2",
        ExpressionAttributeNames: { "#id": "abc" },
        ExpressionAttributeValues: { ":sub2": "u2" },
      })),
      (e) => e.name === "ConditionalCheckFailedException",
    );
  });

  it("ConditionExpression: AND chain requires every predicate true", async () => {
    const ddb = new FakeDdb();
    put(ddb, { PK: "NEED#1", SK: "META", groupItems: { abc: { claimedBy: "u1", status: "claimed" } } });
    await ddb.send(new UpdateCommand({
      TableName: "t",
      Key: { PK: "NEED#1", SK: "META" },
      UpdateExpression: "SET groupItems.#id.#st = :done",
      ConditionExpression: "groupItems.#id.claimedBy = :sub AND groupItems.#id.#st = :claimed",
      ExpressionAttributeNames: { "#id": "abc", "#st": "status" },
      ExpressionAttributeValues: { ":sub": "u1", ":claimed": "claimed", ":done": "done" },
    }));
    assert.equal(ddb.store.get("NEED#1|META").groupItems.abc.status, "done");
    await assert.rejects(
      ddb.send(new UpdateCommand({
        TableName: "t",
        Key: { PK: "NEED#1", SK: "META" },
        UpdateExpression: "SET groupItems.#id.#st = :done",
        ConditionExpression: "groupItems.#id.claimedBy = :other AND groupItems.#id.#st = :claimed",
        ExpressionAttributeNames: { "#id": "abc", "#st": "status" },
        ExpressionAttributeValues: { ":other": "u2", ":claimed": "claimed", ":done": "done" },
      })),
      (e) => e.name === "ConditionalCheckFailedException",
    );
  });

  it("existing ADD-only usage (bumpFlagCount style) still works with no ConditionExpression", async () => {
    const ddb = new FakeDdb();
    put(ddb, { PK: "NEED#1", SK: "META", flagCount: 1 });
    const res = await ddb.send(new UpdateCommand({
      TableName: "t",
      Key: { PK: "NEED#1", SK: "META" },
      UpdateExpression: "ADD flagCount :one",
      ExpressionAttributeValues: { ":one": 1 },
      ReturnValues: "ALL_NEW",
    }));
    assert.equal(res.Attributes.flagCount, 2);
  });
});
