import assert from "node:assert/strict";
import test from "node:test";
import { getHowToSections } from "./how-to.ts";

test("the dev-only how-to section is filtered outside dev builds", () => {
  assert.equal(getHowToSections(false).some((section) => section.devOnly), false);
  assert.equal(getHowToSections(true).some((section) => section.id === "try-it-on-dev"), true);
});

test("only workflow sections use numbered steps with a screen route and specific see copy", () => {
  const sections = getHowToSections(false);
  const sequenceIds = new Set(["asking-for-help", "giving-help", "organizations", "the-desk"]);

  for (const section of sections) {
    if (sequenceIds.has(section.id)) {
      assert.ok(section.steps?.length, section.id);
      for (const step of section.steps ?? []) {
        assert.ok(step.see, `${section.id}/${step.title} needs see copy`);
        assert.ok(step.where, `${section.id}/${step.title} needs a route`);
      }
    } else {
      assert.equal(section.steps, undefined, `${section.id} should not render numbered steps`);
    }
  }

  assert.ok(sections.find((section) => section.id === "language-offline-access")?.cards?.some((card) => card.figures?.length));
});
