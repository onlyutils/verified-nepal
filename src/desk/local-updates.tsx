import { useState } from "react";
import { Newspaper } from "lucide-react";
import { ArticleBody } from "@/articles/render";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { localStrings } from "@/i18n/local";
import { municipalityById, municipalityLabel } from "@/lib/admin-units";
import { districtLabels, type DistrictName } from "@/lib/districts";
import { formatDateTime, formatNumber } from "@/lib/format-date";
import { SectionFrame, SectionLoading } from "./section-ui";
import type { DeskModel } from "./use-desk";

export function LocalUpdates({ model }: { model: DeskModel }) {
  const t = model.ds;
  const local = localStrings[model.language];
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);

  return (
    <SectionFrame title={t.localUpdatesTab} description={t.localUpdatesDescription} refresh={model.loadLocalUpdates} refreshLabel={t.deskRefresh}>
      <Card>
        <CardHeader><CardTitle><h3>{t.localUpdatesRules}</h3></CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="font-semibold">{t.localUpdatesRejectRule}</p>
          <p>{t.localUpdatesOwnRule}</p>
          <p>{t.localUpdatesCorrections}</p>
          <h4 className="font-semibold">{t.localUpdatesChecklist}</h4>
          <ul className="list-disc space-y-2 pl-5">
            <li>{t.localUpdatesDeaths}</li>
            <li>{t.localUpdatesFaces}</li>
            <li>{t.localUpdatesAI}</li>
            <li>{t.localUpdatesCorrect}</li>
          </ul>
        </CardContent>
      </Card>
      {model.localUpdatesError ? <Alert variant="destructive"><AlertDescription>{model.localUpdatesError}</AlertDescription></Alert> : null}
      {model.localUpdatesLoading ? <SectionLoading label={local.loading} /> : !model.localUpdates.length ? (
        <EmptyState icon={Newspaper} title={t.localUpdatesEmpty} action={<Button onClick={model.loadLocalUpdates}>{t.deskRefresh}</Button>} />
      ) : (
        <div className="grid gap-4">
          {model.localUpdates.map((item) => {
            const title = typeof item.title === "string" ? item.title : item.title[item.language || model.language] || item.title.en;
            const municipality = municipalityById(Number(item.locality?.municipalityId));
            const scope = { ward: local.scopeWard, municipality: local.scopeMunicipality, district: local.scopeDistrict, national: local.scopeNational };
            const author = item.author as typeof item.author & { sub?: string };
            const authorSub = (item as typeof item & { authorSub?: string }).authorSub || author.sub;
            const own = Boolean((model.auth.profile?.sub && authorSub === model.auth.profile.sub) ||
              (model.auth.profile?.email && author.email?.toLowerCase() === model.auth.profile.email.toLowerCase()));
            return (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="min-w-0 break-words"><h3>{title}</h3></CardTitle>
                    <StatusBadge tone={toneForStatus(item.status)}>{local.statusPending}</StatusBadge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.author.displayName}</p>
                </CardHeader>
                <CardContent className="space-y-4 break-words">
                  <ArticleBody blocks={item.blocks} body={item.body} language={item.language || model.language} />
                  <dl className="space-y-2 text-sm">
                    <div><dt className="inline font-semibold">{t.localUpdatesScope}: </dt><dd className="inline">{item.scope ? scope[item.scope] : "—"}</dd></div>
                    <div><dt className="inline font-semibold">{t.localUpdatesPlace}: </dt><dd className="inline">
                      {item.locality ? districtLabels[item.locality.district as DistrictName]?.[model.language] || item.locality.district : "—"}
                      {municipality ? ` · ${municipalityLabel(municipality, model.language)}` : ""}
                      {item.locality?.ward ? ` · ${local.scopeWard} ${formatNumber(item.locality.ward, model.language)}` : ""}
                    </dd></div>
                    <div><dt className="inline font-semibold">{t.localUpdatesDate}: </dt><dd className="inline">{formatDateTime(item.happenedAt, model.language) || "—"}</dd></div>
                    <div><dt className="font-semibold">{t.localUpdatesSource}</dt><dd className="space-y-1">
                      {item.sourceUrls?.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block min-h-11 break-all py-2 text-primary underline">{url}</a>)}
                      {item.sourceNote ? <p>{item.sourceNote}</p> : null}
                    </dd></div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    {!own ? <Button disabled={Boolean(model.localUpdateBusy)} onClick={() => void model.handleLocalUpdate(item.id, "publish")}>{t.localUpdatesPublish}</Button> : null}
                    <Button variant="destructive" disabled={Boolean(model.localUpdateBusy)} onClick={() => { setRejectId(item.id); setReason(""); setReasonError(false); }}>{t.localUpdatesReject}</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={Boolean(rejectId)} onOpenChange={(open) => { if (!open && !model.localUpdateBusy) setRejectId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.localUpdatesReject}</DialogTitle></DialogHeader>
          <Label htmlFor="local-reject-reason">{t.localUpdatesReason}</Label>
          <Textarea id="local-reject-reason" value={reason} maxLength={500} aria-invalid={reasonError} onChange={(event) => { setReason(event.target.value); setReasonError(false); }} />
          {reasonError ? <p role="alert" className="text-sm text-destructive">{t.localUpdatesReasonRequired}</p> : null}
          {model.localUpdatesError ? <Alert variant="destructive"><AlertDescription>{model.localUpdatesError}</AlertDescription></Alert> : null}
          <DialogFooter>
            <Button variant="outline" disabled={Boolean(model.localUpdateBusy)} onClick={() => setRejectId(null)}>{model.t.deskCancel}</Button>
            <Button variant="destructive" disabled={Boolean(model.localUpdateBusy)} onClick={async () => {
              if (!reason.trim()) { setReasonError(true); return; }
              if (rejectId && await model.handleLocalUpdate(rejectId, "reject", reason.trim())) setRejectId(null);
            }}>{t.localUpdatesReject}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionFrame>
  );
}
