import { Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { climateData } from "@/lib/climate-data";
import { messageText } from "@/lib/climate-messages";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";
import type { DeskModel } from "./use-desk";

const countryNames = new Map(climateData.countries.map((country) => [country.iso3, country.name]));

function DayStrip({ model }: { model: DeskModel }) {
  const days = model.climateStats?.days ?? [];
  const maxValue = Math.max(1, ...days.flatMap((day) => [day.messages, day.downloads]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{model.ds.deskClimateDays}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-36 items-stretch gap-1">
          {days.map((day, index) => (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 items-end gap-px" title={`${day.date}: ${day.messages} / ${day.downloads}`}>
                <div className="w-1/2 rounded-t bg-primary" style={{ height: `${(day.messages / maxValue) * 100}%` }} />
                <div className="w-1/2 rounded-t bg-primary/40" style={{ height: `${(day.downloads / maxValue) * 100}%` }} />
              </div>
              <div className="h-4 truncate text-[10px] text-muted-foreground">
                {index === 0 || index === days.length - 1 ? day.date : ""}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ClimateStats({ model }: { model: DeskModel }) {
  const stats = model.climateStats;
  const messages = stats?.totals.messages ?? 0;
  const downloads = stats?.totals.downloads ?? 0;
  const today = stats?.days[stats.days.length - 1]?.messages ?? 0;

  return (
    <SectionFrame
      title={model.ds.deskClimateTab}
      description={model.ds.deskClimateDescription}
      refresh={model.loadClimateStats}
      refreshLabel={model.ds.deskRefresh}
    >
      {model.climateStatsLoading ? (
        <SectionLoading label={model.t.deskAdminStatsLoading} />
      ) : model.climateStatsError ? (
        <SectionError message={model.climateStatsError} retry={model.loadClimateStats} retryLabel={model.ds.deskRefresh} />
      ) : !stats ? (
        <SectionEmpty icon={Globe} title={model.ds.deskClimateTab} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard value={messages} label={model.ds.deskClimateMessages} tone="primary" />
            <StatCard value={downloads} label={model.ds.deskClimateDownloads} />
            <StatCard value={messages ? (downloads / messages).toFixed(2) : "—"} label={model.ds.deskClimateRate} />
            <StatCard value={today} label={model.ds.deskClimateToday} />
          </div>

          <DayStrip model={model} />

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{model.ds.deskClimateTopCountries}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{model.ds.deskClimateColCountry}</TableHead>
                      <TableHead className="text-right">{model.ds.deskClimateColCount}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topCountries.map((country) => (
                      <TableRow key={country.iso3}>
                        <TableCell>{countryNames.get(country.iso3) ?? country.iso3}</TableCell>
                        <TableCell className="text-right tabular-nums">{country.messages}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{model.ds.deskClimateTopMessages}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{model.ds.deskClimateColMessage}</TableHead>
                      <TableHead className="text-right">{model.ds.deskClimateColCount}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topMessages
                      .filter((message) => message.count > 0)
                      .map((message) => (
                        <TableRow key={message.messageId}>
                          <TableCell>{messageText(message.messageId)}</TableCell>
                          <TableCell className="text-right tabular-nums">{message.count}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{model.ds.deskClimateByKind}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{model.ds.deskClimateColKind}</TableHead>
                      <TableHead className="text-right">{model.ds.deskClimateColCount}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.downloadsByKind.map((download) => (
                      <TableRow key={download.kind}>
                        <TableCell>{download.kind}</TableCell>
                        <TableCell className="text-right tabular-nums">{download.count}</TableCell>
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
