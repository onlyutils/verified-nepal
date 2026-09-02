import assert from "node:assert/strict";
import test from "node:test";
import { opmcmReportSearchUrl, opmcmReportUrl } from "./urls.ts";

test("OPMCM report search URL encodes Devanagari and trims the query", () => {
  const url = new URL(opmcmReportSearchUrl("  तारानाथ चौलागाई "));
  assert.equal(url.origin + url.pathname, "https://rescue.opmcm.gov.np/api/person-reports");
  assert.equal(url.searchParams.get("search"), "तारानाथ चौलागाई");
  assert.equal(url.searchParams.get("limit"), "30");
  assert.equal(url.searchParams.get("type"), null, "both lost and found reports are searched");
});

test("OPMCM report URL points at the portal's per-report page", () => {
  assert.equal(opmcmReportUrl("6a96e1944adf6b183feab9e1"), "https://rescue.opmcm.gov.np/person-reports/6a96e1944adf6b183feab9e1");
});
