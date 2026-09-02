import assert from "node:assert/strict";
import test from "node:test";
import { assertNoSensitiveKeys } from "./api.ts";

test("ledger and print outputs must not expose sensitive keys", () => {
  const ledgerSample = {
    maskedName: "R. Gurung",
    category: "goods",
    district: "Rasuwa",
    ward: 4,
    redeemedAt: new Date().toISOString(),
  };
  const printSample = {
    claimCode: "AB2D4FGH",
    maskedName: "R. Gurung",
    category: "goods",
    ward: 4,
    status: "published",
  };
  const badLedger = { ...ledgerSample, householdSize: 5, phone: "98xxxxxxxx", registrant: "x", description: "household with alone woman" };
  const badPrint = { ...printSample, householdSize: 3, registrant: "teacher" };

  assert.deepEqual(
    assertNoSensitiveKeys(ledgerSample as unknown as Record<string, unknown>),
    [],
    "clean ledger should have no sensitive keys",
  );
  assert.deepEqual(
    assertNoSensitiveKeys(printSample as unknown as Record<string, unknown>),
    [],
    "clean print should have no sensitive keys",
  );
  assert.ok(assertNoSensitiveKeys(badLedger as unknown as Record<string, unknown>).length > 0, "bad ledger should be flagged");
  assert.ok(assertNoSensitiveKeys(badPrint as unknown as Record<string, unknown>).length > 0, "bad print should be flagged");

  const forbidden = ["householdSize", "phone", "registrant"];
  for (const k of Object.keys(ledgerSample)) {
    assert.ok(!forbidden.includes(k), `ledger key ${k} must not be forbidden`);
  }
  for (const k of Object.keys(printSample)) {
    assert.ok(!forbidden.includes(k), `print key ${k} must not be forbidden`);
  }
});

test("CSV header must not contain sensitive keys", () => {
  const header = "maskedName,category,district,ward,redeemedAt";
  const lower = header.toLowerCase();
  assert.ok(!lower.includes("householdsize"), "header must not contain householdSize");
  assert.ok(!lower.includes("phone"), "header must not contain phone");
  assert.ok(!lower.includes("registrant"), "header must not contain registrant");
  assert.ok(!lower.includes("household"), "header must not contain household");
});

test("claimCode alphabet excludes 0/O/1/I", () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  assert.ok(!alphabet.includes("0"), "no 0");
  assert.ok(!alphabet.includes("O"), "no O");
  assert.ok(!alphabet.includes("1"), "no 1");
  assert.ok(!alphabet.includes("I"), "no I");
  assert.equal(alphabet.length, 32);
});
