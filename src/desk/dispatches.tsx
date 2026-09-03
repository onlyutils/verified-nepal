import { Newspaper } from "lucide-react";
import { ArticleBody } from "@/articles/render";
import { articlesPublicStrings } from "@/i18n/articles-public";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";
import type { DeskModel } from "./use-desk";

function localized(value: string | { en: string; ne?: string }, language: "en" | "ne") {
  return typeof value === "string" ? value : value[language] || value.en;
}
function statusLabel(t: Record<string, string>, status: string) {
  return t[`deskStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`] ?? status;
}

function ArticlePreview({ dispatch, language }: { dispatch: NonNullable<DeskModel["dispatches"]>[number]; language: "en" | "ne" }) {
  const t = articlesPublicStrings[language];
  return (
    <div className="space-y-5">
      {dispatch.cover?.url ? (
        <figure className="space-y-2">
          <img
            src={dispatch.cover.url}
            alt={dispatch.cover.caption || localized(dispatch.title, language)}
            className="aspect-video w-full rounded-xl object-cover"
          />
          <figcaption className="space-y-1 text-sm text-muted-foreground">
            {dispatch.cover.caption ? <span className="block">{dispatch.cover.caption}</span> : null}
            <span className="block">
              {t.source}: {dispatch.cover.source}
            </span>
          </figcaption>
        </figure>
      ) : null}
      <ArticleBody blocks={dispatch.blocks} body={dispatch.body} language={language} />
    </div>
  );
}

export function Dispatches({ model }: { model: DeskModel }) {
  return (
    <SectionFrame
      title={model.t.deskDispatchesTitle}
      description={model.ds.deskDispatchesDescription}
      refresh={model.loadDispatches}
      refreshLabel={model.ds.deskRefresh}
    >
      {model.dispatchesLoading ? (
        <SectionLoading label={model.t.deskDispatchesLoading} />
      ) : model.dispatchesError ? (
        <SectionError message={model.dispatchesError} retry={model.loadDispatches} retryLabel={model.t.deskRetry} />
      ) : !model.dispatches.length ? (
        <SectionEmpty icon={Newspaper} title={model.t.deskDispatchesEmpty} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border bg-background md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{model.ds.deskTableItem}</TableHead>
                  <TableHead>{model.ds.deskTableStatus}</TableHead>
                  <TableHead>{model.ds.deskTableCreated}</TableHead>
                  <TableHead>{model.ds.deskTableActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.dispatches.map((dispatch) => (
                  <TableRow key={dispatch.id}>
                    <TableCell>
                      <p className="font-semibold">{localized(dispatch.title, model.language)}</p>
                      <p className="text-xs text-muted-foreground">{dispatch.author.displayName}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={toneForStatus(dispatch.status)}>{statusLabel(model.t, dispatch.status)}</StatusBadge>
                    </TableCell>
                    <TableCell>{new Date(dispatch.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => model.handleDispatchPublish(dispatch.id)}>
                          {model.t.deskDispatchesPublish}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            model.setDispatchRejectId(dispatch.id);
                            model.setDispatchRejectCode("");
                            model.setDispatchRejectDetail("");
                          }}
                        >
                          {model.t.deskDispatchesReject}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-4 md:hidden">
            {model.dispatches.map((dispatch) => (
              <Card key={dispatch.id}>
                <CardHeader>
                  <div className="flex flex-wrap justify-between gap-2">
                    <CardTitle>{localized(dispatch.title, model.language)}</CardTitle>
                    <StatusBadge tone={toneForStatus(dispatch.status)}>{statusLabel(model.t, dispatch.status)}</StatusBadge>
                  </div>
                  <CardDescription>
                    {model.t.dispatchMetaBy} {dispatch.author.displayName}
                    {dispatch.author.place ? ` · ${dispatch.author.place}` : ""} · {new Date(dispatch.createdAt).toLocaleString()} ·{" "}
                    {dispatch.tags.join(", ")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-secondary p-4">
                    <ArticlePreview dispatch={dispatch} language={model.language} />
                  </div>
                  <div className="rounded-lg border border-dashed p-4">
                    <p className="text-xs font-semibold text-muted-foreground">{model.ds.dispatchPrivateLabel}</p>
                    <p className="mt-2 text-sm">{dispatch.author.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{model.t.dispatchWriteEmailHint}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => model.handleDispatchPublish(dispatch.id)}>{model.t.deskDispatchesPublish}</Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        model.setDispatchRejectId(dispatch.id);
                        model.setDispatchRejectCode("");
                        model.setDispatchRejectDetail("");
                      }}
                    >
                      {model.t.deskDispatchesReject}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </SectionFrame>
  );
}
