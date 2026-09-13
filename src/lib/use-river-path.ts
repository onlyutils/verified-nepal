import { useEffect, useState } from "react";
import { fetchRiverPath, type RiverPath } from "./flood-manifest";

const MANIFEST_URL = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_FLOOD_MANIFEST_URL as string | undefined;

let riverPathPromise: Promise<RiverPath> | null = null;
let riverPathWarningShown = false;

function loadRiverPath(): Promise<RiverPath> | null {
  if (!MANIFEST_URL) return null;
  if (!riverPathPromise) {
    riverPathPromise = fetchRiverPath(MANIFEST_URL).catch((error: unknown) => {
      if (!riverPathWarningShown) {
        riverPathWarningShown = true;
        console.warn("Unable to load flood river path", error);
      }
      throw error;
    });
  }
  return riverPathPromise;
}

export function useRiverPath(): RiverPath | null {
  const [riverPath, setRiverPath] = useState<RiverPath | null>(null);

  useEffect(() => {
    const promise = loadRiverPath();
    if (!promise) return;

    let cancelled = false;
    void promise
      .then((path) => {
        if (!cancelled) setRiverPath(path);
      })
      .catch(() => {
        // The shared loader has already logged the failure once.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return riverPath;
}
