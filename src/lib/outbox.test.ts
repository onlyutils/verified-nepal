import assert from "node:assert/strict";
import test from "node:test";
import { enqueue, flush, list, remove, subscribe } from "./outbox.ts";

const values = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => void values.set(key, value),
  removeItem: (key) => void values.delete(key),
  clear: () => values.clear(),
  key: () => null,
  length: 0,
} as Storage;

function reset() {
  values.clear();
}

function response(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

test("enqueue stores a submission id and notifies subscribers", () => {
  reset();
  let notifications = 0;
  const unsubscribe = subscribe(() => notifications++);
  const item = enqueue({ path: "/needs", method: "POST", body: { description: "offline" }, needsAuth: true });
  unsubscribe();
  assert.equal(list().length, 1);
  assert.equal(item.attempts, 0);
  assert.equal((item.body as { submissionId: string }).submissionId, item.id);
  assert.equal(notifications, 1);
});

test("flush preserves order, removes 2xx and ordinary 4xx, and keeps 5xx/network failures", async () => {
  reset();
  const first = enqueue({ path: "/first", method: "POST", body: {}, needsAuth: true });
  const second = enqueue({ path: "/second", method: "POST", body: {}, needsAuth: true });
  const third = enqueue({ path: "/third", method: "POST", body: {}, needsAuth: true });
  const fourth = enqueue({ path: "/fourth", method: "POST", body: {}, needsAuth: true });
  const paths: string[] = [];
  const statuses = new Map([
    [first.id, 200],
    [second.id, 400],
    [third.id, 503],
  ]);
  const result = await flush({
    fetchImpl: async (path, init) => {
      paths.push(`${path}:${JSON.parse(String(init?.body)).submissionId}`);
      if (path === "/fourth") throw new TypeError("Failed to fetch");
      const id = JSON.parse(String(init?.body)).submissionId;
      return response(statuses.get(id) ?? 503);
    },
    getToken: () => "token",
  });
  assert.deepEqual(paths, [`/first:${first.id}`, `/second:${second.id}`, `/third:${third.id}`, `/fourth:${fourth.id}`]);
  assert.deepEqual(result, { sent: 1, failed: 2, dropped: 1 });
  assert.deepEqual(
    list().map((item) => item.id),
    [third.id, fourth.id],
  );
  assert.equal(list()[0].attempts, 1);
});

test("remove deletes one queued item", () => {
  reset();
  const item = enqueue({ path: "/needs", method: "POST", body: {}, needsAuth: false });
  remove(item.id);
  assert.deepEqual(list(), []);
});
