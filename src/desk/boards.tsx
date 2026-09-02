import { LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeDisplay } from "@/components/code-display";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";
import type { DeskModel } from "./use-desk";

function statusLabel(t: Record<string, string>, status: string) {
  return t[`deskStatus${status.charAt(0).toUpperCase()}${status.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}`] ?? status;
}

function NeedActions({ model, needId, claimCode, status }: { model: DeskModel; needId: string; claimCode?: string; status: string }) {
  const selected = model.selectedOfferId[needId];
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-2">
          <Label htmlFor={`offer-${needId}`}>{model.t.deskMatchPickOffer}</Label>
          <NativeSelect
            id={`offer-${needId}`}
            value={selected || ""}
            onChange={(event) => model.setSelectedOfferId((current) => ({ ...current, [needId]: event.target.value }))}
          >
            <NativeSelectOption value="">{model.t.deskSelectOfferPlaceholder}</NativeSelectOption>
            {model.filteredOffers.map((offer) => (
              <NativeSelectOption key={offer.id} value={offer.id}>
                {offer.helperLabel} — {offer.categories.join(", ")} ({offer.id.slice(0, 8)})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button className="self-end" variant="outline" onClick={() => model.handleNeedStatus(needId, "matched")} disabled={!selected}>
          {model.t.deskMatch}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => model.setFulfillId(needId)}>
          {model.t.deskFulfill}
        </Button>
        <Button variant="ghost" onClick={() => model.setArchiveId(needId)}>
          {model.t.deskArchive}
        </Button>
        {claimCode && (status === "published" || status === "matched") ? (
          <Button onClick={() => model.setRedeemCode(claimCode)}>{model.t.deskRedeem}</Button>
        ) : null}
      </div>
      {model.filteredOffers.length === 0 ? <p className="text-sm text-muted-foreground">{model.t.deskNoOffersHint}</p> : null}
      {model.matchedContact[needId] ? (
        <div className="rounded-lg border bg-primary-soft p-4">
          <p className="font-semibold text-primary">{model.t.deskMatchedContactTitle}</p>
          <dl className="mt-3 grid gap-2 text-sm">
            {Object.entries(model.matchedContact[needId] as Record<string, unknown>)
              .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
              .map(([key, value]) => (
                <div key={key} className="grid gap-1 sm:grid-cols-[8rem_1fr]">
                  <dt className="font-semibold capitalize text-muted-foreground">{key}</dt>
                  <dd className="break-words">{String(value)}</dd>
                </div>
              ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export function Boards({ model }: { model: DeskModel }) {
  return (
    <SectionFrame
      title={model.t.deskBoardsTitle}
      description={model.ds.deskBoardsDescription}
      refresh={model.loadBoards}
      refreshLabel={model.ds.deskRefresh}
    >
      {model.boardsLoading ? (
        <SectionLoading label={model.t.deskBoardsLoading} />
      ) : model.boardsError ? (
        <SectionError message={model.boardsError} retry={model.loadBoards} retryLabel={model.t.deskRetry} />
      ) : model.filteredNeeds.length === 0 ? (
        <SectionEmpty icon={LayoutList} title={model.t.deskBoardsEmpty} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border bg-background md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{model.ds.deskTableItem}</TableHead>
                  <TableHead>{model.ds.deskTableStatus}</TableHead>
                  <TableHead>{model.ds.deskTableLocation}</TableHead>
                  <TableHead>{model.ds.deskTableCreated}</TableHead>
                  <TableHead>{model.ds.deskTableActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.filteredNeeds.map((need) => (
                  <TableRow key={need.id} className="align-top">
                    <TableCell>
                      <p className="font-semibold">{need.maskedName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{need.category}</p>
                      {need.claimCode ? <p className="mt-2 font-mono text-xs tracking-widest">{need.claimCode}</p> : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={toneForStatus(need.status)}>{statusLabel(model.t, need.status)}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      {need.district} · W{need.ward}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(need.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => model.setFulfillId(need.id)}>
                          {model.t.deskFulfill}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => model.setArchiveId(need.id)}>
                          {model.t.deskArchive}
                        </Button>
                        {need.claimCode && (need.status === "published" || need.status === "matched") ? (
                          <Button size="sm" onClick={() => model.setRedeemCode(need.claimCode as string)}>
                            {model.t.deskRedeem}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-4 md:hidden">
            {model.filteredNeeds.map((need) => (
              <Card key={need.id}>
                <CardHeader className="gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle>{need.maskedName}</CardTitle>
                    <StatusBadge tone={toneForStatus(need.status)}>{statusLabel(model.t, need.status)}</StatusBadge>
                  </div>
                  <CardDescription>
                    {need.district} · W{need.ward} · {new Date(need.createdAt).toLocaleDateString()}
                  </CardDescription>
                  {need.claimCode ? (
                    <CodeDisplay code={need.claimCode} kind="claim" label={model.t.deskClaimCode} hint={model.t.deskClaimCodeHint} />
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm leading-6">{need.description}</p>
                  <Separator />
                  <NeedActions model={model} needId={need.id} claimCode={need.claimCode} status={need.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </SectionFrame>
  );
}
