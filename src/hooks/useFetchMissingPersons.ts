import { useEffect, useState } from "react";
import type { MissingPersonRecord } from "../types";
import { fetchMissingPersons } from "../live";

/**
 * ----------------------
 * Fetch Missing persons
 * ---------------------
 **/
export default function useFetchMissingPersons(
  searched?: boolean 
) {
  const [missingPersons, setMissingPersons] = useState<
    MissingPersonRecord[] | null
  >(null);
  const [missingLoading, setMissingLoading] = useState(false);
  const [missingError, setMissingError] = useState(false);
  useEffect(() => {
    if (!searched || missingPersons || missingLoading || missingError) return;
    let cancelled = false;
    const controller = new AbortController();
    setMissingLoading(true);

    fetchMissingPersons(controller.signal)
      .then((payload) => {
        if (!cancelled) setMissingPersons(payload.results);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.warn("Missing-person records fetch failed", error);
          if (!cancelled) setMissingError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setMissingLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [missingError, missingPersons, searched]);

  return {
    data: missingPersons,
    isLoading: missingLoading,
    error: missingError,
  } as const;
}
