import { useState } from "react";
import { meStrings } from "@/i18n/me";
import { posterStrings } from "@/i18n/poster";
import { deleteMissing, getMissingTips, putMissing, type MissingBody, type MissingTip, type MyMissing } from "@/lib/api";
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
  const [tipsOpen, setTipsOpen] = useState<Record<string, boolean>>({});
  const [tipsLoading, setTipsLoading] = useState<Record<string, boolean>>({});
  const [tips, setTips] = useState<Record<string, MissingTip[]>>({});

  const toggleTips = async (m: MyMissing) => {
    if (!auth.idToken || !m.tipsCount) return;
    if (tips[m.id]) {
      setTipsOpen((open) => ({ ...open, [m.id]: !open[m.id] }));
      return;
    }
    setTipsLoading((loading) => ({ ...loading, [m.id]: true }));
    try {
      const result = await getMissingTips(auth.idToken, m.id);
      setTips((current) => ({ ...current, [m.id]: result.items }));
      setTipsOpen((open) => ({ ...open, [m.id]: true }));
    } catch {
      // The dashboard remains useful even if the optional tips panel fails.
    } finally {
      setTipsLoading((loading) => ({ ...loading, [m.id]: false }));
    }
  };

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
          {m.photo ? <img src={m.photo.url} alt={m.name} className="aspect-square w-full object-cover" loading="lazy" /> : null}
          <CardHeader>
            <CardTitle className="text-base">{m.name}</CardTitle>
            <CardDescription>{m.district}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={m.status === "found" ? "success" : "danger"}>
              {m.status === "found" ? tp.headlineFound : tp.headlineMissing}
            </StatusBadge>
            <StatusBadge tone={m.publicationStatus === "rejected" ? "danger" : m.publicationStatus === "published" ? "success" : "info"}>
              {m.publicationStatus === "rejected" ? t.posterRejected : m.publicationStatus === "published" ? t.posterPublished : t.posterPending}
            </StatusBadge>
            {m.tipsCount ? <Button type="button" size="sm" variant="ghost" onClick={() => void toggleTips(m)} disabled={tipsLoading[m.id]}>{tipsLoading[m.id] ? t.posterTipsLoading : t.posterTips.replace("{n}", String(m.tipsCount))}</Button> : null}
            {m.rejectReason ? <p className="w-full text-sm text-destructive">{t.posterRejectionReason.replace("{reason}", m.rejectReason)}</p> : null}
            {tipsOpen[m.id] ? (
              <div className="w-full space-y-2 rounded-md bg-muted/50 p-3 text-sm">
                {(tips[m.id] || []).map((tip) => (
                  <div key={tip.id} className="border-b pb-2 last:border-0 last:pb-0">
                    <p>{tip.message}</p>
                    {tip.contact ? <p className="text-muted-foreground">{t.posterTipContact.replace("{contact}", tip.contact)}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
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
