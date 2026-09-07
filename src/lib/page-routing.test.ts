import assert from "node:assert/strict";
import test from "node:test";
import { pageFromPath } from "./page-routing.ts";

test("maps public and signed-in routes, while keeping unknown paths not found", () => {
  const routes = {
    "/": "dashboard",
    "": "dashboard",
    "/?x=1": "dashboard",
    "/index.html": "dashboard",
    "/index.html/": "dashboard",
    "/get-help": "getHelp",
    "/desk/login": "deskLogin",
    "/desk/boards": "desk",
    "/how-to": "howTo",
    "/how-to/": "howTo",
    "/poster/abc": "posterView",
    "/status/ABC": "getHelp",
    "/donation/XYZ": "donationStatus",
    "/unknown": "notFound",
  } as const;

  for (const [path, expected] of Object.entries(routes)) {
    assert.equal(pageFromPath(path), expected, path);
  }
});
