import { ExternalLink, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";
import type { DeskModel } from "./use-desk";
import { formatDateTime, formatNumber } from "@/lib/format-date";

export function Flags({ model }: { model: DeskModel }) {
  return (
    <SectionFrame
      title={model.t.deskFlagsTab}
      description={model.ds.deskFlagsDescription}
      refresh={model.loadFlags}
      refreshLabel={model.ds.deskRefresh}
    >
      <section aria-labelledby="flagged-needs">
        <h3 id="flagged-needs" className="mb-4 text-lg font-semibold">
          {model.ds.deskFlagsNeedsTitle}
        </h3>
        {model.flagsLoading ? (
          <SectionLoading label={model.t.deskFlagsLoading} />
        ) : model.flagsError ? (
          <SectionError message={model.flagsError} retry={model.loadFlags} retryLabel={model.t.deskRetry} />
        ) : !model.flags.length ? (
          <SectionEmpty icon={Flag} title={model.t.deskFlagsEmpty} />
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
                  {model.flags.map((item) => (
                    <TableRow key={item.needId}>
                      <TableCell>
                        <p className="font-semibold">
                          {item.maskedName} · W{item.ward}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">{item.needId}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="danger">
                          {formatNumber(item.flagCount, model.language)} {model.t.deskFlagCount.replace("{count}", "")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.district} · W{item.ward}
                      </TableCell>
                      <TableCell>{formatDateTime(item.flags[0]?.createdAt ?? Date.now(), model.language)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => item.flags[0] && model.setConfirmAction({ kind: "flag", action: "resolve", id: item.flags[0].id, center: false })}>
                            {model.t.deskResolve}
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={`/desk/boards?need=${encodeURIComponent(item.needId)}`}>{model.t.deskFlagOpen}</a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-4 md:hidden">
              {model.flags.map((item) => (
                <Card key={item.needId}>
                  <CardHeader>
                    <div className="flex flex-wrap justify-between gap-2">
                      <CardTitle>
                        {item.maskedName} · W{item.ward}
                      </CardTitle>
                      <Badge variant="danger">
                        {formatNumber(item.flagCount, model.language)} {model.t.deskFlagCount.replace("{count}", "")}
                      </Badge>
                    </div>
                    <CardDescription>
                      {item.district} · {item.needId}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {item.flags.map((flag, index) => (
                        <li key={`${flag.createdAt}-${index}`} className="rounded-lg border bg-secondary p-3">
                          <p className="text-sm font-semibold">{flag.reason}</p>
                          {flag.details ? <p className="mt-1 text-sm leading-6">{flag.details}</p> : null}
                          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(flag.createdAt, model.language)}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => model.setConfirmAction({ kind: "flag", action: "resolve", id: flag.id, center: false })}>
                              {model.t.deskResolve}
                            </Button>
                            <Button size="sm" variant="link" asChild>
                              <a href={`/desk/boards?need=${encodeURIComponent(item.needId)}`}>{model.t.deskFlagOpen}</a>
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>
      <section className="border-t pt-6" aria-labelledby="flagged-centers">
        <h3 id="flagged-centers" className="mb-4 text-lg font-semibold">
          {model.ds.deskFlagsCentersTitle}
        </h3>
        {model.centerFlagsLoading ? (
          <SectionLoading label={model.dos.centerFlagsLoading} />
        ) : model.centerFlagsError ? (
          <SectionError message={model.centerFlagsError} retry={model.loadCenterFlags} retryLabel={model.t.deskRetry} />
        ) : !model.centerFlags.length ? (
          <SectionEmpty title={model.dos.centerFlagsEmpty} />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border bg-background md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{model.ds.deskTableItem}</TableHead>
                    <TableHead>{model.ds.deskTableStatus}</TableHead>
                    <TableHead>{model.ds.deskTableLocation}</TableHead>
                    <TableHead>{model.ds.deskTableActions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.centerFlags.map((center) => (
                    <TableRow key={center.centerId}>
                      <TableCell>
                        <p className="font-semibold">{center.name}</p>
                        <p className="text-xs text-muted-foreground">{center.orgName}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="danger">{formatNumber(center.flagCount, model.language)}</Badge>
                      </TableCell>
                      <TableCell>{center.district}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => center.reasons[0] && model.setConfirmAction({ kind: "flag", action: "resolve", id: center.reasons[0].id, center: true })}>
                            {model.t.deskResolve}
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={`/drop-centers/${center.centerId}`} target="_blank" rel="noreferrer">
                              <ExternalLink aria-hidden="true" />
                              {model.dos.centerFlagsViewPublic}
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-4 md:hidden">
              {model.centerFlags.map((center) => (
                <Card key={center.centerId}>
                  <CardHeader>
                    <div className="flex justify-between gap-2">
                      <CardTitle>{center.name}</CardTitle>
                      <Badge variant="danger">{formatNumber(center.flagCount, model.language)}</Badge>
                    </div>
                    <CardDescription>
                      {center.orgName} · {center.district}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/drop-centers/${center.centerId}`} target="_blank" rel="noreferrer">
                        <ExternalLink aria-hidden="true" />
                        {model.dos.centerFlagsViewPublic}
                      </a>
                    </Button>
                    <ul className="mt-4 space-y-2">
                      {center.reasons.map((reason, index) => (
                        <li key={`${reason.createdAt}-${index}`} className="rounded-lg border bg-secondary p-3 text-sm">
                          <p className="font-semibold">{reason.reason}</p>
                          {reason.details ? <p className="mt-1">{reason.details}</p> : null}
                          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(reason.createdAt, model.language)}</p>
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => model.setConfirmAction({ kind: "flag", action: "resolve", id: reason.id, center: true })}>
                            {model.t.deskResolve}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>
    </SectionFrame>
  );
}
