import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CLIMATE_MESSAGES, CLIMATE_MESSAGE_GROUPS, CLIMATE_DOWNLOAD_KINDS } from "./climate-messages.ts";
import { CLIMATE_MESSAGE_IDS, CLIMATE_DOWNLOAD_KINDS as SERVER_KINDS } from "../../server/src/constants.js";

describe("climate message catalogue", () => {
  it("has 54 unique ids in 4 groups and matches the server list", () => {
    assert.equal(CLIMATE_MESSAGE_GROUPS.length, 4);
    assert.equal(CLIMATE_MESSAGES.length, 54);
    assert.equal(new Set(CLIMATE_MESSAGES.map((m) => m.id)).size, 54);
    assert.deepEqual(CLIMATE_MESSAGES.map((m) => m.id), CLIMATE_MESSAGE_IDS);
    assert.deepEqual(CLIMATE_DOWNLOAD_KINDS, SERVER_KINDS);
  });
});
