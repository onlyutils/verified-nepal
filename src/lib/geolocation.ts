import { districtCentroids } from "./district-centroids";
import type { DistrictName } from "./districts";

export function nearestDistrict(lat: number, lng: number): DistrictName {
  return districtCentroids.reduce((nearest, candidate) => {
    const nearestDistance = (nearest.lat - lat) ** 2 + (nearest.lng - lng) ** 2;
    const candidateDistance = (candidate.lat - lat) ** 2 + (candidate.lng - lng) ** 2;
    return candidateDistance < nearestDistance ? candidate : nearest;
  }).district;
}

export function tryGeolocate(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: { lat: number; lng: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timeout = globalThis.setTimeout(() => finish(null), 5000);
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          globalThis.clearTimeout(timeout);
          finish({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => {
          globalThis.clearTimeout(timeout);
          finish(null);
        },
        { timeout: 5000, maximumAge: 300000 },
      );
    } catch {
      globalThis.clearTimeout(timeout);
      finish(null);
    }
  });
}
