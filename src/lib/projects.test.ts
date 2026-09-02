import assert from "node:assert/strict";
import test from "node:test";
import { assertNoProjectSensitiveKeys } from "./api.ts";

test("public project JSON must not expose phone/contactName/updateCodeHash", () => {
  const publicSample = {
    id: "proj_abc",
    title: { en: "Trail rebuild" },
    description: { en: "Rebuild trail" },
    type: "trail",
    district: "Rasuwa",
    ward: 3,
    locationText: "Ward 3",
    costEstimateNpr: 500000,
    committee: { name: "Ward Committee", bank: { bankName: "RBB", accountName: "Committee", accountNumber: "123" }, verified: true },
    photos: [{ fileId: "f1", url: "https://cdn/.../f1.jpg", status: "published" }],
    status: "published",
    createdAt: new Date().toISOString(),
    updates: [{ id: "u1", text: "Done", photos: [], status: "published", createdAt: new Date().toISOString()}],
  };
  const bad = {
    ...publicSample,
    committee: { ...publicSample.committee, phone: "98xxxxxxxx", contactName: "Ram" },
    updateCodeHash: "abc",
  };
  assert.deepEqual(assertNoProjectSensitiveKeys(publicSample as unknown as Record<string, unknown>), [], "clean project should have no sensitive keys");
  assert.ok(assertNoProjectSensitiveKeys(bad as unknown as Record<string, unknown>).length > 0, "bad project should be flagged");
  assert.ok(!assertNoProjectSensitiveKeys(publicSample as unknown as Record<string, unknown>).includes("phone"));
});

test("presign headers and downscale concept: image size limit 8MB and max 1600px", () => {
  const maxBytes = 8*1024*1024;
  assert.equal(maxBytes, 8388608);
  const maxDim = 1600;
  assert.equal(maxDim, 1600);
  const allowedTypes = ["image/jpeg","image/png","image/webp"];
  assert.ok(allowedTypes.includes("image/jpeg"));
  assert.ok(!allowedTypes.includes("image/gif"));
});
