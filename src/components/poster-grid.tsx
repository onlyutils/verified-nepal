import { useState } from "react";
import { meStrings } from "@/i18n/me";
import { posterStrings } from "@/i18n/poster";
import { deleteMissing, putMissing, type MissingBody, type MyMissing } from "@/lib/api";
import { useGoogleAuth } from "@/lib/auth";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export function posterEditPath(id: string) {
  return `/poster/${encodeURIComponent(id)}`;
}

/** Saved posters as cards with open / mark found / delete. Shared by /poster and /me. */
export function PosterGrid({
  language,
  items,
  onChange,
}: {
  language: Language;
  items: MyMissing[];
  onChange: (next: (items: MyMissing[]) => MyMissing[]) => void;
}) {
  const t = meStrings[language];
  const tp = posterStrings[language];
  const auth = useGoogleAuth();
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const toggleFound = async (m: MyMissing) => {
    if (!auth.idToken) return;
    const status = m.status === "found" ? "missing" : "found";
    setBusy((b) => ({ ...b, [m.id]: true }));
    try {
      const { id, createdAt, updatedAt, ...fields } = m as MyMissing & MissingBody;
      await putMissing(auth.idToken, m.id, { ...fields, status });
      onChange((list) => list.map((x) => (x.id === m.id ? { ...x, status } : x)));
    } catch {}
    setBusy((b) => ({ ...b, [m.id]: false }));
  };

  const remove = async (id: string) => {
    if (!auth.idToken || !window.confirm(t.posterDeleteConfirm)) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await deleteMissing(auth.idToken, id);
      onChange((list) => list.filter((x) => x.id !== id));
    } catch {}
    setBusy((b) => ({ ...b, [id]: false }));
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((m) => (
        <Card key={m.id} className="overflow-hidden">
          {m.photo ? <img src={m.photo.url} alt="" className="aspect-square w-full object-cover" loading="lazy" /> : null}
          <CardHeader>
            <CardTitle className="text-base">{m.name}</CardTitle>
            <CardDescription>{m.district}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={m.status === "found" ? "success" : "danger"}>
              {m.status === "found" ? tp.headlineFound : tp.headlineMissing}
            </StatusBadge>
            <Button asChild size="sm" variant="outline">
              <a href={posterEditPath(m.id)}>{t.posterOpen}</a>
            </Button>
            <Button size="sm" variant="outline" type="button" disabled={busy[m.id]} onClick={() => toggleFound(m)}>
              {m.status === "found" ? t.posterMissingAgain : t.posterFound}
            </Button>
            <Button size="sm" variant="ghost" type="button" disabled={busy[m.id]} onClick={() => remove(m.id)}>
              {t.posterDelete}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
