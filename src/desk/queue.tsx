import { Inbox, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { SectionEmpty, SectionError, SectionLoading, SectionFrame } from "./section-ui";
import type { DeskModel } from "./use-desk";
import { districtNames } from "@/lib/geo";

function categoryLabel(t: Record<string, string>, category: string) {
  const key = `category${category.charAt(0).toUpperCase()}${category.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}`;
  return t[key] ?? category;
}

function statusLabel(t: Record<string, string>, status: string) {
  return t[`deskStatus${status.charAt(0).toUpperCase()}${status.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}`] ?? status;
}

export function Queue({ model }: { model: DeskModel }) {
  const { t } = model;
  return (
    <SectionFrame
      title={t.deskQueueTitleRevised}
      description={model.ds.deskQueueDescription}
      refresh={model.loadQueue}
      refreshLabel={model.ds.deskRefresh}
    >
      <div className="grid gap-4 rounded-xl border bg-background p-4 sm:grid-cols-[minmax(12rem,0.4fr)_minmax(16rem,1fr)]">
        <div className="space-y-2">
          <Label htmlFor="queue-district">{model.ds.deskQueueDistrictFilter}</Label>
          <NativeSelect id="queue-district" value={model.queueDistrict} onChange={(event) => model.setQueueDistrict(event.target.value)}>
            <NativeSelectOption value="">{model.ds.deskAllDistricts}</NativeSelectOption>
            {(model.scopeDistricts.length > 0 ? model.scopeDistricts : districtNames).map((district) => (
              <NativeSelectOption key={district} value={district}>
                {district}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="queue-search">{model.ds.deskQueueSearchLabel}</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="queue-search"
              className="pl-9"
              value={model.queueSearch}
              onChange={(event) => model.setQueueSearch(event.target.value)}
              placeholder={model.ds.deskQueueSearchPlaceholder}
            />
          </div>
        </div>
      </div>
      {model.queueLoading ? (
        <SectionLoading label={t.deskQueueLoading} />
      ) : model.queueError ? (
        <SectionError message={model.queueError} retry={model.loadQueue} retryLabel={t.deskRetry} />
      ) : model.filteredQueue.length === 0 ? (
        <SectionEmpty icon={Inbox} title={t.deskQueueEmpty} />
      ) : (
        <div className="grid gap-4">
          {model.filteredQueue.map((item) => {
            const district = item.district || item.districts?.[0] || "—";
            const category = String(item.category || item.categories?.join(", ") || "");
            const flagCount = typeof item.flagCount === "number" ? item.flagCount : 0;
            return (
              <Card key={item.id}>
                <CardHeader className="gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">{item.maskedName || item.helperLabel || item.beneficiary?.name || item.id}</CardTitle>
                      <Badge variant="secondary">{categoryLabel(t, category)}</Badge>
                      {flagCount ? (
                        <Badge variant="danger">
                          {flagCount} {t.deskFlagCount.replace("{count}", "")}
                        </Badge>
                      ) : null}
                    </div>
                    <StatusBadge tone={toneForStatus(String(item.status || "pending"))}>
                      {statusLabel(t, String(item.status || "pending"))}
                    </StatusBadge>
                  </div>
                  <CardDescription>
                    {district} · W{item.ward ?? "—"} · {new Date(item.createdAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border bg-secondary p-4">
                      <p className="text-xs font-semibold text-primary">{t.deskQueuePublicPreview}</p>
                      <p className="mt-3 font-semibold">{item.maskedName || item.helperLabel || "—"}</p>
                      <p className="text-sm text-muted-foreground">
                        {district} · W{item.ward ?? "—"} · {categoryLabel(t, category)}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.description}</p>
                    </div>
                    <div className="rounded-lg border border-dashed p-4">
                      <p className="text-xs font-semibold text-muted-foreground">{t.deskQueuePrivateDetails}</p>
                      {item.beneficiary ? (
                        <div className="mt-3 space-y-1 text-sm">
                          <p>
                            <strong>{t.deskQueueBeneficiary}:</strong> {item.beneficiary.name}
                          </p>
                          {item.beneficiary.phone ? (
                            <p>
                              <strong>{t.deskQueueContact}:</strong> {item.beneficiary.phone}
                            </p>
                          ) : null}
                          {item.beneficiary.email ? (
                            <p>
                              <strong>{t.deskQueueEmail}:</strong> {item.beneficiary.email}
                            </p>
                          ) : null}
                          <p>
                            {item.beneficiary.district} · W{item.beneficiary.ward}
                          </p>
                          {item.beneficiary.householdSize !== undefined ? (
                            <p>
                              <strong>{t.deskQueueHousehold}:</strong> {item.beneficiary.householdSize}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {item.registrant ? (
                        <p className="mt-3 text-sm">
                          <strong>{t.deskQueueRegistrant}:</strong> {item.registrant.name} · {item.registrant.phone}
                          {item.registrant.email ? ` · ${item.registrant.email}` : ""}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">{t.deskNoRegistrant}</p>
                      )}
                      {item.dupCandidates?.length ? (
                        <Alert className="mt-4 border-warning bg-warning-soft text-warning">
                          <AlertDescription>
                            <p className="text-sm font-semibold">
                              {model.ds.deskDetails}: {t.deskQueueDupTitle}
                            </p>
                            <ul className="mt-2 list-disc pl-5 text-sm">
                              {item.dupCandidates.map((duplicate) => (
                                <li key={duplicate.id}>
                                  {duplicate.maskedName} · W{duplicate.ward} ({duplicate.id.slice(0, 8)})
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 text-xs">{t.deskQueueDupHint}</p>
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <p className="mt-4 text-sm text-muted-foreground">{t.deskQueueDupEmpty}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`publish-${item.id}`}
                      checked={!!model.publishConfirmed[item.id]}
                      onCheckedChange={(checked) => model.setPublishConfirmed((current) => ({ ...current, [item.id]: checked === true }))}
                    />
                    <Label htmlFor={`publish-${item.id}`} className="leading-6">
                      {model.ds.publishConfirmLabel}
                    </Label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => model.handlePublish(item.id)} disabled={!model.publishConfirmed[item.id]}>
                      {t.deskPublish}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        model.setRejectId(item.id);
                        model.setRejectCode("");
                        model.setRejectDetail("");
                        model.setRejectError(null);
                      }}
                    >
                      {t.deskReject}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </SectionFrame>
  );
}
