import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import { loadTokens } from "@/lib/tokens";
import { flush, list, subscribe } from "@/lib/outbox";
import { shellStrings } from "@/i18n/shell";
import type { Language } from "@/lib/types";
import { formatNumber } from "@/lib/format-date";
import { Button } from "@/components/ui/button";

export function OutboxBadge({ language }: { language: Language }) {
  const [count, setCount] = useState(() => list().length);
  const sync = useCallback(async () => {
    await flush({
      fetchImpl: (path, init) => fetch(`${API_BASE}${path}`, init),
      getToken: () => loadTokens()?.access_token ?? null,
    });
    setCount(list().length);
  }, []);

  useEffect(() => subscribe(() => setCount(list().length)), []);

  useEffect(() => {
    const online = () => void sync();
    window.addEventListener("online", online);
    const timer = window.setTimeout(() => void sync(), 60_000);
    return () => {
      window.removeEventListener("online", online);
      window.clearTimeout(timer);
    };
  }, [sync]);

  if (count === 0) return null;
  const text = shellStrings[language].outboxWaiting.replace("{n}", formatNumber(count, language));
  return (
    <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => void sync()}>
      {text} · {shellStrings[language].outboxSyncNow}
    </Button>
  );
}
