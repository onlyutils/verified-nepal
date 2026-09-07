import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format-date";
import type { DeskModel } from "./use-desk";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";

export function Posters({ model }: { model: DeskModel }) {
  const [publishId, setPublishId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const t = model.ds;
  const reject = async () => {
    if (!rejectId || !reason.trim()) {
      setActionError(t.deskPostersRejectRequired);
      return;
    }
    try {
      await model.handlePosterModeration(rejectId, "reject", reason.trim());
      setRejectId(null);
      setReason("");
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t.deskPostersRejectRequired);
    }
  };
  const publish = async () => {
    if (!publishId) return;
    try {
      await model.handlePosterModeration(publishId, "publish");
      setPublishId(null);
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t.deskPostersPublishConfirm);
    }
  };
  return (
    <SectionFrame title={t.deskPostersTitle} description={t.deskPostersDescription} refresh={model.loadPosters} refreshLabel={t.deskRefresh}>
      {actionError ? <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert> : null}
      {model.postersLoading ? <SectionLoading label={t.deskPostersLoading} /> : null}
      {model.postersError ? <SectionError message={model.postersError} retry={model.loadPosters} retryLabel={model.t.deskRetry} /> : null}
      {!model.postersLoading && !model.postersError && model.posters.length === 0 ? <SectionEmpty title={t.deskPostersEmpty} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {model.posters.map((poster) => {
          const photo = poster.photo && typeof poster.photo === "object" && "url" in poster.photo ? String(poster.photo.url) : "";
          const phones = Array.isArray(poster.phones) ? poster.phones.join(", ") : poster.phone || "";
          const age = typeof poster.age === "string" || typeof poster.age === "number" ? String(poster.age) : "";
          const place = typeof poster.place === "string" ? poster.place : "";
          const lastSeenAt = typeof poster.lastSeenAt === "string" ? poster.lastSeenAt : "";
          return (
            <Card key={poster.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle>{poster.name}</CardTitle>
                  <StatusBadge tone="warning">{model.t.deskStatusPending}</StatusBadge>
                </div>
                <CardDescription>{poster.district} · {formatDateTime(poster.createdAt, model.language)}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {photo ? <img src={photo} alt={poster.name} className="aspect-video w-full rounded-md object-cover" /> : null}
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="font-semibold text-muted-foreground">{t.deskPostersAge}</dt><dd>{age || "—"}</dd></div>
                  <div><dt className="font-semibold text-muted-foreground">{t.deskPostersLastSeen}</dt><dd>{place || "—"}{lastSeenAt ? ` · ${formatDateTime(lastSeenAt, model.language)}` : ""}</dd></div>
                  <div className="sm:col-span-2"><dt className="font-semibold text-muted-foreground">{t.deskPostersContact}</dt><dd>{phones || poster.email || "—"}</dd></div>
                </dl>
                {poster.duplicateHint ? <p className="text-sm text-warning">{t.deskPostersDuplicate}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setPublishId(poster.id)}>{t.deskPostersPublish}</Button>
                  <Button variant="destructive" onClick={() => { setRejectId(poster.id); setReason(""); setActionError(null); }}>{t.deskPostersReject}</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Dialog open={Boolean(publishId)} onOpenChange={(open) => !open && setPublishId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.deskConfirmTitle}</DialogTitle><DialogDescription>{t.deskPostersPublishConfirm}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setPublishId(null)}>{model.t.deskCancel}</Button><Button onClick={() => void publish()}>{t.deskPostersPublish}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(rejectId)} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.deskPostersRejectTitle}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-2"><Label htmlFor="poster-reject-reason">{t.deskPostersRejectPlaceholder}</Label><Input id="poster-reject-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setRejectId(null)}>{model.t.deskCancel}</Button><Button variant="destructive" onClick={() => void reject()}>{t.deskPostersReject}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionFrame>
  );
}
