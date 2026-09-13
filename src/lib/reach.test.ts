import assert from "node:assert/strict";
import test from "node:test";
import { buildReachPayload } from "./reach.ts";

const base = {
  pathname: "/",
  search: "",
  referrer: "",
  host: "verifiednepal.org",
  language: "en" as const,
  firstInSession: false,
};

test("skips desk, desk login, and organisation pages", () => {
  for (const page of ["desk", "deskLogin", "org"] as const) {
    assert.equal(buildReachPayload({ ...base, page }), null);
  }
});

test("keeps only the flood impact location query", () => {
  assert.deepEqual(buildReachPayload({ ...base, page: "floodImpact", pathname: "/flood-impact", search: "?loc=Rasuwa&other=ignored" }), {
    page: "floodImpact",
    path: "/flood-impact?loc=Rasuwa",
    lang: "en",
    newSession: false,
  });
  assert.equal(buildReachPayload({ ...base, page: "dashboard", pathname: "/", search: "?loc=Rasuwa" })?.path, "/");
});

test("includes a different referrer only for the first session hit", () => {
  const first = buildReachPayload({
    ...base,
    page: "dashboard",
    firstInSession: true,
    referrer: "https://news.example/story",
  });
  assert.equal(first?.ref, "news.example");

  const repeat = buildReachPayload({
    ...base,
    page: "dashboard",
    firstInSession: false,
    referrer: "https://news.example/story",
  });
  assert.equal(repeat?.ref, undefined);
  assert.equal(
    buildReachPayload({ ...base, page: "dashboard", firstInSession: true, referrer: "https://verifiednepal.org/other" })?.ref,
    undefined,
  );
});

test("caps the path at 200 characters", () => {
  const path = `/${"a".repeat(220)}`;
  assert.equal(buildReachPayload({ ...base, page: "dashboard", pathname: path })?.path.length, 200);
});
