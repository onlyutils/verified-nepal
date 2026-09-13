import { test } from "node:test";
import assert from "node:assert/strict";
import { flowBearingDownDeg, nearestPointOnPath, pointAlongPath, shortestArcDeg, subPathBetween, type LatLng } from "./flood-geometry.ts";

function assertClose(actual: number, expected: number, tolerance = 0.5) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

test("flowBearingDownDeg turns east- and south-flowing paths screen-down", () => {
  const eastPath: LatLng[] = [
    [27, 85],
    [27, 85.1],
  ];
  const southPath: LatLng[] = [
    [28, 85],
    [27, 85],
  ];

  assertClose(flowBearingDownDeg([27, 85.05], eastPath), -90);
  assertClose(flowBearingDownDeg([27.5, 85], southPath), 0);
});

test("flowBearingDownDeg clamps its flow window at both path ends", () => {
  const path: LatLng[] = [
    [29, 85],
    [28, 85],
    [28, 86],
  ];

  const beforeStart = nearestPointOnPath([30, 85], path);
  const afterEnd = nearestPointOnPath([28, 87], path);
  assert.equal(nearestPointOnPath([28.5, 85], path)?.segmentIndex, 0);
  assert.equal(beforeStart?.distanceAlongKm, 0);
  assert.ok((afterEnd?.distanceAlongKm ?? 0) > 110);
  assertClose(flowBearingDownDeg([30, 85], path), 0);
  assertClose(flowBearingDownDeg([28, 87], path), -90);
});

test("subPathBetween includes projected endpoints and reverses travel order", () => {
  const path: LatLng[] = [
    [27, 85],
    [27, 85.1],
    [27.2, 85.1],
  ];

  assert.deepEqual(subPathBetween(path, [27, 85.05], [27.05, 85.1]), [
    [27, 85.05],
    [27, 85.1],
    [27.05, 85.1],
  ]);
  assert.deepEqual(subPathBetween(path, [27.05, 85.1], [27, 85.05]), [
    [27.05, 85.1],
    [27, 85.1],
    [27, 85.05],
  ]);
});

test("pointAlongPath clamps fractions and follows distance rather than vertices", () => {
  const path: LatLng[] = [
    [27, 85],
    [27, 85.1],
    [27.2, 85.1],
  ];

  assert.deepEqual(pointAlongPath(path, -1), path[0]);
  assert.deepEqual(pointAlongPath(path, 2), path[2]);
  const midpoint = pointAlongPath(path, 0.5);
  assertClose(midpoint[0], 27.06, 0.01);
  assertClose(midpoint[1], 85.1, 0.001);
});

test("shortestArcDeg crosses the 360-degree boundary in the short direction", () => {
  assert.equal(shortestArcDeg(350, 10), 20);
  assert.equal(shortestArcDeg(10, 350), -20);
});
