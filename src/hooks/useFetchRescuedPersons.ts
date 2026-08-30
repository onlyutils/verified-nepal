import { useEffect, useState } from "react";
import type { PersonRecord } from "../types";

/**
 * ----------------------
 * Fetch Rescued persons
 * ---------------------
 **/
export default function useFetchRescuedPersons(searched?: boolean) {
  const [persons, setPersons] = useState<PersonRecord[] | null>(null);
  const [rescuedLoading, setRescuedLoading] = useState(false);
  const [rescuedError, setRescuedError] = useState(false);

  useEffect(() => {
    if (!searched || persons || rescuedLoading || rescuedError) return;
    let cancelled = false;
    const control = new AbortController();
    const signal = control.signal;

    setRescuedLoading(true);
    fetch("/data/rescued-persons.json", {
      signal,
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`Failed to load person records: ${response.status}`);
        return response.json() as Promise<{ results: PersonRecord[] }>;
      })
      .then((payload) => {
        if (!cancelled) setPersons(payload.results);
      })
      .catch((error) => {
        if (signal.aborted) return;
        console.warn("Rescued records fetch failed", error);
        if (!cancelled) setRescuedError(true);
      })
      .finally(() => {
        if (!cancelled) setRescuedLoading(false);
      });

    return () => {
      cancelled = true;
      control.abort();
    };
  }, [persons, rescuedError, searched]);

  return {
    data: persons,
    isLoading: rescuedLoading,
    error: rescuedError,
  } as const;
}
