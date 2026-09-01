import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "./api.ts";
import { dequeue, enqueue, flush, load } from "./goods-queue.ts";

test("enqueue adds item with id and queuedAt", () => {
  const body = { entryType: "intake", category: "rice", qty: 5 } as unknown as { entryType: "intake"; category: string; qty: number };
  const list = enqueue([], "center-1", body);
  assert.equal(list.length, 1);
  assert.equal(list[0].centerId, "center-1");
  assert.deepEqual(list[0].body, body);
  assert.ok(typeof list[0].id === "string" && list[0].id.length > 0);
  assert.ok(typeof list[0].queuedAt === "string");
  // original list not mutated
  assert.equal([].length, 0);
});

test("enqueue generates unique ids", () => {
  const body = { entryType: "intake", category: "rice", qty: 1 } as unknown as never;
  const a = enqueue([], "c1", body);
  const b = enqueue(a, "c1", body);
  assert.notEqual(a[0].id, b[1].id);
});

test("dequeue removes by id", () => {
  const body = { entryType: "intake", category: "rice", qty: 1 } as unknown as never;
  const list = enqueue(enqueue([], "c1", body), "c1", body);
  const idToRemove = list[0].id;
  const next = dequeue(list, idToRemove);
  assert.equal(next.length, 1);
  assert.equal(next[0].id, list[1].id);
});

test("dequeue with unknown id returns same length", () => {
  const body = { entryType: "intake", category: "rice", qty: 1 } as unknown as never;
  const list = enqueue([], "c1", body);
  const next = dequeue(list, "nope");
  assert.equal(next.length, 1);
});

test("flush keeps network failures and drops 4xx and successes", async () => {
  const body = { entryType: "intake", category: "rice", qty: 1 } as unknown as never;
  const a = enqueue([], "c1", body)[0];
  const b = enqueue([], "c1", body)[0];
  const c = enqueue([], "c1", body)[0];
  const d = enqueue([], "c1", body)[0];
  const list = [a, b, c, d];

  let call = 0;
  const send = async (item: typeof a) => {
    call++;
    if (item.id === a.id) return; // success
    if (item.id === b.id) throw new ApiError("bad", 400, null);
    if (item.id === c.id) throw new ApiError("offline", 0, null);
    if (item.id === d.id) throw new TypeError("Failed to fetch");
  };

  const remaining = await flush(list, send);
  assert.equal(call, 4);
  assert.equal(remaining.length, 2);
  assert.ok(remaining.some((x) => x.id === c.id), "should keep status 0");
  assert.ok(remaining.some((x) => x.id === d.id), "should keep TypeError");
  assert.ok(!remaining.some((x) => x.id === a.id));
  assert.ok(!remaining.some((x) => x.id === b.id));
});

test("flush drops 5xx as well", async () => {
  const body = { entryType: "intake", category: "rice", qty: 1 } as unknown as never;
  const item = enqueue([], "c1", body)[0];
  const remaining = await flush([item], async () => {
    throw new ApiError("server", 500, null);
  });
  assert.equal(remaining.length, 0);
});

test("load returns [] when localStorage is absent (node)", () => {
  const result = load();
  assert.deepEqual(result, []);
});
