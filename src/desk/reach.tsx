import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DayStrip } from "@/components/day-strip";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format-date";
import { listCenters, type AdminReachStats } from "@/lib/api";
import { pageTitle } from "@/App";
import { reachStrings } from "@/i18n/reach";
import type { AppPage } from "@/lib/page-routing";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";
import type { DeskModel } from "./use-desk";

let centerNamesPromise: Promise<Map<string, string>> | null = null;

function loadCenterNames() {
  if (centerNamesPromise) return centerNamesPromise;
  centerNamesPromise = (async () => {
    const names = new Map<string, string>();
    let cursor: string | undefined;
    // ponytail: Scan at most 10 public center pages; add a server-side center-name lookup if this directory grows beyond that ceiling.
    for (let page = 0; page < 10; page += 1) {
      const response = await listCenters(cursor ? { cursor } : {});
      response.items.forEach((center) => names.set(center.id, center.name));
      if (!response.cursor || response.cursor === cursor) break;
      cursor = response.cursor;
    }
    return names;
  })();
  return centerNamesPromise;
}

function centerIdFromPath(path: string) {
  const rawId = path.slice("/drop-centers/".length).split("/")[0];
  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
}

function locationFromPath(path: string) {
  try {
    return new URL(path, "https://verifiednepal.local").searchParams.get("loc");
  } catch {
    return null;
  }
}

function pathLabel(page: string, path: string, centerNames: Map<string, string>, noLocation: string) {
  if (page === "dropCenterDetail" && path.startsWith("/drop-centers/")) {
    const id = centerIdFromPath(path);
    return centerNames.get(id) ?? id;
  }
  if (page === "floodImpact") return locationFromPath(path) || noLocation;
  return path;
}

function ReachFeatureCard({
  title,
  pages,
  pathPage,
  stats,
  centerNames,
  language,
}: {
  title: string;
  pages: string[];
  pathPage: string;
  stats: AdminReachStats;
  centerNames: Map<string, string>;
  language: "en" | "ne";
}) {
  const t = reachStrings[language];
  const pageStats = new Map(stats.pages.map((item) => [item.page, item]));
  const total = (key: "views" | "last30") => pages.reduce((sum, page) => sum + (pageStats.get(page)?.[key] ?? 0), 0);
  const days = stats.days.map((day) => ({
    date: day.date,
    primary: pages.reduce((sum, page) => sum + (day.pages[page] ?? 0), 0),
  }));
  const paths = stats.paths.filter((item) => item.page === pathPage).slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-secondary p-3">
            <p className="text-2xl font-bold tabular-nums">{formatNumber(total("last30"), language)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.last30}</p>
          </div>
          <div className="rounded-lg border bg-secondary p-3">
            <p className="text-2xl font-bold tabular-nums">{formatNumber(total("views"), language)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.allTime}</p>
          </div>
        </div>

        <DayStrip title={t.last30Days} days={days} primaryLabel={t.views} />

        <div>
          <h3 className="mb-2 text-sm font-semibold">{t.topPaths}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.path}</TableHead>
                <TableHead className="text-right">{t.views}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paths.length > 0 ? (
                paths.map((item) => (
                  <TableRow key={`${item.page}:${item.path}`}>
                    <TableCell className="max-w-0">
                      <a
                        className="block truncate text-primary underline-offset-4 hover:underline"
                        href={item.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={item.path}
                      >
                        {pathLabel(item.page, item.path, centerNames, t.noLocation)}
                      </a>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(item.views, language)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    {t.noPaths}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReachStats({ model }: { model: DeskModel }) {
  const t = reachStrings[model.language];
  const stats = model.reachStats;
  const [centerNames, setCenterNames] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let active = true;
    void loadCenterNames()
      .then((names) => {
        if (active) setCenterNames(names);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <SectionFrame title={t.title} description={t.description} refresh={model.loadReachStats} refreshLabel={model.ds.deskRefresh}>
      {model.reachStatsLoading ? (
        <SectionLoading label={t.loading} />
      ) : model.reachStatsError ? (
        <SectionError message={model.reachStatsError} retry={model.loadReachStats} retryLabel={model.ds.deskRefresh} />
      ) : !stats ? (
        <SectionEmpty icon={BarChart3} title={t.empty} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard value={formatNumber(stats.today.views, model.language)} label={t.viewsToday} tone="primary" />
            <StatCard value={formatNumber(stats.last30.views, model.language)} label={t.viewsLast30} />
            <StatCard value={formatNumber(stats.last30.sessions, model.language)} label={t.visitsLast30} />
            <StatCard value={formatNumber(stats.totals.views, model.language)} label={t.viewsAllTime} />
          </div>

          <DayStrip
            title={t.last30Days}
            days={stats.days.map((day) => ({ date: day.date, primary: day.views, secondary: day.sessions }))}
            primaryLabel={t.views}
            secondaryLabel={t.sessions}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <ReachFeatureCard
              title={t.dropCenters}
              pages={["dropCenters", "dropCenterDetail"]}
              pathPage="dropCenterDetail"
              stats={stats}
              centerNames={centerNames}
              language={model.language}
            />
            <ReachFeatureCard
              title={t.floodImpact}
              pages={["floodImpact"]}
              pathPage="floodImpact"
              stats={stats}
              centerNames={centerNames}
              language={model.language}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t.allPages}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.page}</TableHead>
                    <TableHead className="text-right">{t.last30}</TableHead>
                    <TableHead className="text-right">{t.allTime}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.pages.length > 0 ? (
                    stats.pages.map((item) => (
                      <TableRow key={item.page}>
                        <TableCell>{pageTitle(item.page as AppPage, model.language) || item.page}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(item.last30, model.language)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(item.views, model.language)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        {t.empty}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t.referrers}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.host}</TableHead>
                      <TableHead className="text-right">{t.visits}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.referrers.length > 0 ? (
                      stats.referrers.map((item) => (
                        <TableRow key={item.host}>
                          <TableCell>{item.host}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(item.views, model.language)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-muted-foreground">
                          {t.empty}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.languages}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.language}</TableHead>
                      <TableHead className="text-right">{t.views}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ["en", t.english, stats.languages.en],
                      ["ne", t.nepali, stats.languages.ne],
                    ].map(([key, label, views]) => (
                      <TableRow key={key}>
                        <TableCell>{label}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(Number(views), model.language)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </SectionFrame>
  );
}
