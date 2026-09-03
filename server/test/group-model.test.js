import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FakeDdb } from "./helpers.js";
import {
  startGroup, addGroupItem, joinGroup, claimGroupItem, releaseGroupItem, markGroupItemDone,
} from "../src/models/group.js";

function makeNeed(id) {
  return {
    PK: `NEED#${id}`, SK: "META", type: "NEED", id, status: "published",
    beneficiary: { name: "Rita Gurung", district: "Rasuwa", ward: 5 },
    category: "shelter", createdAt: new Date().toISOString(),
  };
}

async function seed(id) {
  const ddb = new FakeDdb();
  const need = makeNeed(id);
  ddb.store.set(`NEED#${id}|META`, need);
  return { ddb, need };
}

describe("group model", () => {
  it("startGroup sets an auto-generated masked name, and rejects a second call", async () => {
    const { ddb, need } = await seed("n1");
    const result = await startGroup(ddb, "t", { need, actorSub: "u1", actorName: "Founder F." });
    assert.match(result.name, /^Help group — Rita G\., Rasuwa$/);
    const stored = ddb.store.get("NEED#n1|META");
    assert.equal(stored.group.createdBy, "u1");
    assert.deepEqual(stored.groupItems, {});
    assert.equal(stored.groupMembers.u1.name, "Founder F.");
    await assert.rejects(
      startGroup(ddb, "t", { need: stored, actorSub: "u2", actorName: "Someone" }),
      (e) => e.status === 409 && e.message === "group_exists",
    );
  });

  it("addGroupItem adds a free-text item; two different helpers can claim two different items without clobbering each other", async () => {
    const { ddb, need } = await seed("n2");
    await startGroup(ddb, "t", { need, actorSub: "u1", actorName: "U1" });
    const itemA = await addGroupItem(ddb, "t", { needId: "n2", description: "Tarp and rope", actorSub: "u1" });
    const itemB = await addGroupItem(ddb, "t", { needId: "n2", description: "Rice and dal", actorSub: "u1" });

    await claimGroupItem(ddb, "t", { needId: "n2", itemId: itemA.itemId, actorSub: "u2", actorName: "U2" });
    await claimGroupItem(ddb, "t", { needId: "n2", itemId: itemB.itemId, actorSub: "u3", actorName: "U3" });

    const stored = ddb.store.get("NEED#n2|META");
    assert.equal(stored.groupItems[itemA.itemId].claimedBy, "u2", "concurrent claim on item A must not be lost");
    assert.equal(stored.groupItems[itemB.itemId].claimedBy, "u3", "concurrent claim on item B must not be lost");
    assert.equal(stored.groupItems[itemA.itemId].description, "Tarp and rope");
    assert.equal(stored.groupItems[itemB.itemId].description, "Rice and dal");
  });

  it("claimGroupItem rejects a second claimer on the same item, allows the same claimer to re-claim", async () => {
    const { ddb, need } = await seed("n3");
    await startGroup(ddb, "t", { need, actorSub: "u1", actorName: "U1" });
    const item = await addGroupItem(ddb, "t", { needId: "n3", description: "Medical kit", actorSub: "u1" });
    await claimGroupItem(ddb, "t", { needId: "n3", itemId: item.itemId, actorSub: "u2", actorName: "Helper H." });
    await assert.rejects(
      claimGroupItem(ddb, "t", { needId: "n3", itemId: item.itemId, actorSub: "u3", actorName: "U3" }),
      (e) => e.status === 409 && e.message === "already_claimed",
    );
    await claimGroupItem(ddb, "t", { needId: "n3", itemId: item.itemId, actorSub: "u2", actorName: "Helper H." });
    const stored = ddb.store.get("NEED#n3|META");
    assert.equal(stored.groupItems[item.itemId].claimedBy, "u2");
    assert.equal(stored.groupMembers.u2.name, "Helper H.");
  });

  it("claiming auto-joins without resetting an existing member's joinedAt", async () => {
    const { ddb, need } = await seed("n4");
    await startGroup(ddb, "t", { need, actorSub: "u1", actorName: "U1" });
    await joinGroup(ddb, "t", { needId: "n4", actorSub: "u2", actorName: "U2" });
    const joinedAt = ddb.store.get("NEED#n4|META").groupMembers.u2.joinedAt;
    const item = await addGroupItem(ddb, "t", { needId: "n4", description: "Water", actorSub: "u1" });
    await claimGroupItem(ddb, "t", { needId: "n4", itemId: item.itemId, actorSub: "u2", actorName: "U2" });
    assert.equal(ddb.store.get("NEED#n4|META").groupMembers.u2.joinedAt, joinedAt, "re-claiming must not reset joinedAt");
  });

  it("releaseGroupItem only works for the claimer, then the item is claimable again", async () => {
    const { ddb, need } = await seed("n5");
    await startGroup(ddb, "t", { need, actorSub: "u1", actorName: "U1" });
    const item = await addGroupItem(ddb, "t", { needId: "n5", description: "Transport", actorSub: "u1" });
    await claimGroupItem(ddb, "t", { needId: "n5", itemId: item.itemId, actorSub: "u2", actorName: "U2" });
    await assert.rejects(
      releaseGroupItem(ddb, "t", { needId: "n5", itemId: item.itemId, actorSub: "u3" }),
      (e) => e.status === 409 && e.message === "not_claim_owner",
    );
    await releaseGroupItem(ddb, "t", { needId: "n5", itemId: item.itemId, actorSub: "u2" });
    let stored = ddb.store.get("NEED#n5|META");
    assert.equal(stored.groupItems[item.itemId].status, "open");
    assert.equal(stored.groupItems[item.itemId].claimedBy, undefined);
    await claimGroupItem(ddb, "t", { needId: "n5", itemId: item.itemId, actorSub: "u3", actorName: "U3" });
    stored = ddb.store.get("NEED#n5|META");
    assert.equal(stored.groupItems[item.itemId].claimedBy, "u3");
  });

  it("markGroupItemDone only works for the current claimer and only from claimed status", async () => {
    const { ddb, need } = await seed("n6");
    await startGroup(ddb, "t", { need, actorSub: "u1", actorName: "U1" });
    const item = await addGroupItem(ddb, "t", { needId: "n6", description: "Firewood", actorSub: "u1" });
    await assert.rejects(
      markGroupItemDone(ddb, "t", { needId: "n6", itemId: item.itemId, actorSub: "u2" }),
      (e) => e.status === 409 && e.message === "not_claim_owner",
      "cannot mark done before claiming",
    );
    await claimGroupItem(ddb, "t", { needId: "n6", itemId: item.itemId, actorSub: "u2", actorName: "U2" });
    await assert.rejects(
      markGroupItemDone(ddb, "t", { needId: "n6", itemId: item.itemId, actorSub: "u3" }),
      (e) => e.status === 409 && e.message === "not_claim_owner",
    );
    const result = await markGroupItemDone(ddb, "t", { needId: "n6", itemId: item.itemId, actorSub: "u2" });
    const stored = ddb.store.get("NEED#n6|META");
    assert.equal(stored.groupItems[item.itemId].status, "done");
    assert.equal(stored.groupItems[item.itemId].doneAt, result.doneAt);
  });
});
