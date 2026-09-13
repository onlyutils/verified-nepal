export type LatLng = [number, number];

export type PathProjection = {
  point: LatLng;
  segmentIndex: number;
  segmentT: number;
  distanceAlongKm: number;
};

const DEG_TO_RAD = Math.PI / 180;
const KM_PER_DEGREE = 111.32;
const FLOW_WINDOW_KM = 0.7;

function segmentLengthKm(a: LatLng, b: LatLng): number {
  const cosLat = Math.cos(((a[0] + b[0]) / 2) * DEG_TO_RAD);
  const dLatKm = (b[0] - a[0]) * KM_PER_DEGREE;
  const dLngKm = (b[1] - a[1]) * cosLat * KM_PER_DEGREE;
  return Math.hypot(dLatKm, dLngKm);
}

/** Returns the total length of a polyline in kilometres. */
export function pathLengthKm(path: LatLng[]): number {
  return path.slice(0, -1).reduce((total, start, index) => total + segmentLengthKm(start, path[index + 1]), 0);
}

function projectPointAndT(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; t: number } {
  const cosLat0 = Math.cos(a[0] * DEG_TO_RAD);
  const toXY = ([lat, lng]: LatLng): [number, number] => [(lng - a[1]) * cosLat0, lat - a[0]];
  const [px, py] = toXY(p);
  const [bx, by] = toXY(b);
  const lengthSquared = bx * bx + by * by;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared));
  return {
    point: [a[0] + t * by, a[1] + (t * bx) / cosLat0],
    t,
  };
}

/** Closest point on segment a→b to p, using a flat-Earth approximation. */
export function projectPointOnSegment(p: LatLng, a: LatLng, b: LatLng): LatLng {
  return projectPointAndT(p, a, b).point;
}

/** Snaps a point to the nearest position on a polyline and reports its segment. */
export function nearestPointOnPath(target: LatLng, path: LatLng[]): PathProjection | null {
  if (path.length === 0) return null;
  if (path.length === 1) return { point: [...path[0]], segmentIndex: 0, segmentT: 0, distanceAlongKm: 0 };

  let best: PathProjection | null = null;
  let bestDistanceSquared = Infinity;
  let distanceAlongKm = 0;

  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const projection = projectPointAndT(target, start, end);
    const dLat = projection.point[0] - target[0];
    const dLng = projection.point[1] - target[1];
    const cosLat = Math.cos(target[0] * DEG_TO_RAD);
    const distanceSquared = dLat * dLat + dLng * dLng * cosLat * cosLat;

    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      best = {
        point: projection.point,
        segmentIndex: index,
        segmentT: projection.t,
        distanceAlongKm: distanceAlongKm + projection.t * segmentLengthKm(start, end),
      };
    }
    distanceAlongKm += segmentLengthKm(start, end);
  }

  return best;
}

function pointAtDistanceKm(path: LatLng[], segmentLengths: number[], distanceKm: number): LatLng {
  if (path.length === 0) return [0, 0];
  if (path.length === 1) return [...path[0]];

  const totalDistanceKm = segmentLengths.reduce((sum, length) => sum + length, 0);
  const clampedDistanceKm = Math.max(0, Math.min(totalDistanceKm, distanceKm));
  let distanceBeforeSegmentKm = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const lengthKm = segmentLengths[index];
    if (lengthKm === 0) continue;
    if (clampedDistanceKm <= distanceBeforeSegmentKm + lengthKm || index === segmentLengths.length - 1) {
      const t = Math.max(0, Math.min(1, (clampedDistanceKm - distanceBeforeSegmentKm) / lengthKm));
      const start = path[index];
      const end = path[index + 1];
      return [start[0] + t * (end[0] - start[0]), start[1] + t * (end[1] - start[1])];
    }
    distanceBeforeSegmentKm += lengthKm;
  }

  return [...path[path.length - 1]];
}

function normalizeDegrees(degrees: number): number {
  const normalized = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 ? 180 : normalized;
}

/** Returns the polyline between two projected path positions in travel order. */
export function subPathBetween(path: LatLng[], from: LatLng, to: LatLng): LatLng[] {
  if (path.length === 0) return [];
  if (path.length === 1) return [[...path[0]]];

  const fromProjection = nearestPointOnPath(from, path);
  const toProjection = nearestPointOnPath(to, path);
  if (!fromProjection || !toProjection) return [];

  const appendIfDistinct = (result: LatLng[], point: LatLng) => {
    const previous = result[result.length - 1];
    if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) result.push([...point]);
  };

  const forwardSubPath = (start: PathProjection, end: PathProjection): LatLng[] => {
    const result: LatLng[] = [];
    appendIfDistinct(result, start.point);
    for (let index = start.segmentIndex + 1; index <= end.segmentIndex; index += 1) {
      appendIfDistinct(result, path[index]);
    }
    appendIfDistinct(result, end.point);
    return result;
  };

  if (fromProjection.distanceAlongKm <= toProjection.distanceAlongKm) {
    return forwardSubPath(fromProjection, toProjection);
  }

  return forwardSubPath(toProjection, fromProjection).reverse();
}

/** Returns the point at a normalized fraction of a polyline's total length. */
export function pointAlongPath(path: LatLng[], fraction: number): LatLng {
  if (path.length === 0) return [0, 0];
  if (path.length === 1) return [...path[0]];

  const segmentLengths = path.slice(0, -1).map((start, index) => segmentLengthKm(start, path[index + 1]));
  const totalDistanceKm = segmentLengths.reduce((sum, length) => sum + length, 0);
  return pointAtDistanceKm(path, segmentLengths, totalDistanceKm * Math.max(0, Math.min(1, fraction)));
}

/** Returns the signed shortest rotation from bearing a to bearing b. */
export function shortestArcDeg(a: number, b: number): number {
  return normalizeDegrees(b - a);
}

/** Returns the MapLibre bearing that turns the path's local downstream direction screen-down. */
export function flowBearingDownDeg(point: LatLng, path: LatLng[]): number {
  if (path.length < 2) return 0;

  const segmentLengths = path.slice(0, -1).map((start, index) => segmentLengthKm(start, path[index + 1]));
  const projection = nearestPointOnPath(point, path);
  if (!projection) return 0;

  const upstream = pointAtDistanceKm(path, segmentLengths, projection.distanceAlongKm - FLOW_WINDOW_KM);
  const downstream = pointAtDistanceKm(path, segmentLengths, projection.distanceAlongKm + FLOW_WINDOW_KM);
  const cosLat = Math.cos(projection.point[0] * DEG_TO_RAD);
  const flowHeading = Math.atan2((downstream[1] - upstream[1]) * cosLat, downstream[0] - upstream[0]) / DEG_TO_RAD;

  // MapLibre's bearing is the compass heading that points up. A flow points down
  // when the map bearing is a half-turn behind that heading.
  return normalizeDegrees(flowHeading - 180);
}
