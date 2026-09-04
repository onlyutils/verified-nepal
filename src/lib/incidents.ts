import { useEffect, useState } from "react";
import { listIncidents, type Incident } from "./api";
import { nearestDistrict, tryGeolocate } from "./geolocation";

export const INCIDENT_KEY = "vn:incident";
export const INCIDENT_EVENT = "vn:incident-changed";

function notify() {
  try {
    globalThis.dispatchEvent?.(new Event(INCIDENT_EVENT));
  } catch {}
}

export function loadSelectedIncidentId(): string | null {
  try {
    return globalThis.localStorage?.getItem(INCIDENT_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveSelectedIncidentId(id: string): void {
  try {
    globalThis.localStorage?.setItem(INCIDENT_KEY, id);
  } catch {}
  notify();
}

function mostRecentActive(incidents: Incident[]) {
  return incidents.filter((incident) => incident.status === "active").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function useIncidents(status = "active,pending") {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(() => loadSelectedIncidentId());
  const [defaultResolved, setDefaultResolved] = useState(false);

  useEffect(() => {
    const sync = () => setSelectedId(loadSelectedIncidentId());
    window.addEventListener(INCIDENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(INCIDENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDefaultResolved(false);
    listIncidents(status)
      .then((response) => {
        if (!cancelled) setIncidents(response.items);
      })
      .catch(() => {
        if (!cancelled) setIncidents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (loading || defaultResolved) return;
    const selected = incidents.find(
      (incident) => incident.id === selectedId && (incident.status === "active" || incident.status === "pending"),
    );
    if (selected) {
      setDefaultResolved(true);
      return;
    }
    if (!incidents.some((incident) => incident.status === "active")) {
      setDefaultResolved(true);
      return;
    }
    let cancelled = false;
    tryGeolocate().then((position) => {
      if (cancelled) return;
      const district = position ? nearestDistrict(position.lat, position.lng) : null;
      const districtMatch = district
        ? incidents.find((incident) => incident.status === "active" && incident.affectedDistricts.includes(district))
        : undefined;
      const fallback = districtMatch ?? mostRecentActive(incidents);
      if (fallback) saveSelectedIncidentId(fallback.id);
      setDefaultResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, [defaultResolved, incidents, loading, selectedId]);

  const currentIncident = incidents.find(
    (incident) => incident.id === selectedId && (incident.status === "active" || incident.status === "pending"),
  );
  const currentIncidentId = currentIncident?.id;
  const setCurrentIncidentId = (id: string) => saveSelectedIncidentId(id);

  return { incidents, currentIncident, currentIncidentId, setCurrentIncidentId, loading };
}
