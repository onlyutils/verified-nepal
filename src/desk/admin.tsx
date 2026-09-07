import { Fragment, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DistrictPicker } from "@/components/district-picker";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";
import type { DeskModel } from "./use-desk";
import { formatDateTime, formatNumber } from "@/lib/format-date";
import { getUserWork, type WorkResponse } from "@/lib/api";
import { meStrings } from "@/i18n/me";
import { WorkTally } from "@/components/work-tally";

export function Admin({ model }: { model: DeskModel }) {
  const workT = meStrings[model.language];
  const [workBySub, setWorkBySub] = useState<Record<string, WorkResponse>>({});
  const [expandedWork, setExpandedWork] = useState<string | null>(null);
  const [workLoading, setWorkLoading] = useState<Record<string, boolean>>({});

  const toggleWork = async (sub: string) => {
    if (expandedWork === sub) {
      setExpandedWork(null);
      return;
    }
    if (workBySub[sub]) {
      setExpandedWork(sub);
      return;
    }
    if (!model.auth.idToken) return;
    setWorkLoading((current) => ({ ...current, [sub]: true }));
    try {
      const work = await getUserWork(model.auth.idToken, sub);
      setWorkBySub((current) => ({ ...current, [sub]: work }));
      setExpandedWork(sub);
    } catch {
      setExpandedWork(null);
    } finally {
      setWorkLoading((current) => ({ ...current, [sub]: false }));
    }
  };

  return (
    <SectionFrame
      title={model.t.deskAdminTab}
      description={model.ds.deskAdminDescription}
      refresh={() => {
        void model.handleAdminLookup();
      }}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{model.t.deskAdminLookupTitle}</CardTitle>
            <CardDescription>{model.ds.deskAdminEmailLabel}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="admin-email">{model.ds.deskAdminEmailLabel}</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={model.adminLookupEmail}
                  onChange={(event) => model.setAdminLookupEmail(event.target.value)}
                  placeholder={model.t.deskAdminLookupPlaceholder}
                />
              </div>
              <Button className="self-end" onClick={model.handleAdminLookup} disabled={model.adminLookupLoading}>
                {model.t.deskAdminLookupButton}
              </Button>
            </div>
            {model.adminLookupError ? (
              <Alert variant="destructive">
                <AlertDescription>{model.adminLookupError}</AlertDescription>
              </Alert>
            ) : null}
            {model.adminLookupUser ? (
              <div className="space-y-4 rounded-xl border bg-secondary p-4">
                <div className="grid gap-2 text-sm">
                  <p className="font-semibold">
                    {model.adminLookupUser.email} · {model.adminLookupUser.name || model.t.unavailable}
                  </p>
                  <p>
                    <strong>{model.ds.deskAdminUserId}:</strong> {model.adminLookupUser.sub}
                  </p>
                  <p>
                    <strong>{model.ds.deskAdminCurrentRole}:</strong> {model.adminLookupUser.role}
                  </p>
                  <p>
                    <strong>{model.ds.deskAdminGuidelines}:</strong>{" "}
                    {model.adminLookupUser.guidelinesAckAt ? model.ds.deskAdminYes : model.ds.deskAdminNo}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-role">{model.t.deskAdminRoleLabel}</Label>
                  <NativeSelect id="admin-role" value={model.adminRole} onChange={(event) => model.setAdminRole(event.target.value)}>
                    <NativeSelectOption value="helper">{model.t.deskAdminRoleHelper}</NativeSelectOption>
                    <NativeSelectOption value="moderator">{model.t.deskAdminRoleModerator}</NativeSelectOption>
                    <NativeSelectOption value="admin">{model.t.deskAdminRoleAdmin}</NativeSelectOption>
                  </NativeSelect>
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">{model.t.deskAdminDistrictsLabel}</legend>
                  <div className="mt-3">
                    <DistrictPicker
                      selected={Object.keys(model.adminDistricts).filter((district) => model.adminDistricts[district])}
                      onChange={(districts) => model.setAdminDistricts(Object.fromEntries(districts.map((district) => [district, true])))}
                      language={model.language}
                      searchPlaceholder={model.ds.deskDistrictSearchPlaceholder}
                    />
                  </div>
                </fieldset>
                {model.adminSaveError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{model.adminSaveError}</AlertDescription>
                  </Alert>
                ) : null}
                {model.adminSaveMsg ? (
                  <Alert>
                    <AlertDescription>{model.adminSaveMsg}</AlertDescription>
                  </Alert>
                ) : null}
                <Button onClick={() => model.setAdminConfirmOpen(true)}>{model.t.deskAdminSave}</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{model.t.deskAdminStatsTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {model.adminStatsLoading ? (
                <SectionLoading label={model.t.deskAdminStatsLoading} />
              ) : model.adminStatsError ? (
                <SectionError message={model.adminStatsError} retry={model.loadAdminStats} />
              ) : model.adminStats ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatCard
                    value={formatNumber(model.adminStats.needs.pending, model.language)}
                    label={model.t.deskAdminStatsPendingNeeds.replace("{n}", "")}
                    tone="primary"
                  />
                  <StatCard value={formatNumber(model.adminStats.needs.published, model.language)} label={model.t.deskAdminStatsPublishedNeeds.replace("{n}", "")} />
                  <StatCard value={formatNumber(model.adminStats.offers.pending, model.language)} label={model.t.deskAdminStatsPendingOffers.replace("{n}", "")} />
                  <StatCard value={formatNumber(model.adminStats.projects.pending, model.language)} label={model.t.deskAdminStatsPendingProjects.replace("{n}", "")} />
                  <StatCard
                    value={`${formatNumber(model.adminStats.oldestPendingAgeHours, model.language)} h`}
                    label={model.t.deskAdminStatsOldestPending}
                    tone={model.adminStats.oldestPendingAgeHours > 48 ? "danger" : "default"}
                    hint={model.adminStats.oldestPendingAgeHours > 48 ? model.t.deskAdminStatsOld : undefined}
                  />
                  <StatCard value={formatNumber(model.adminStats.moderators, model.language)} label={model.t.deskAdminStatsModerators.replace("{n}", "")} />
                </div>
              ) : (
                <SectionEmpty icon={ShieldCheck} title={model.t.deskAdminStatsError} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{model.t.deskAdminModeratorsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {model.adminModeratorsLoading ? (
            <SectionLoading label={model.t.deskAdminModeratorsLoading} />
          ) : !model.adminModerators.length ? (
            <SectionEmpty title={model.t.deskAdminModeratorsEmpty} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{model.ds.deskAdminModeratorEmail}</TableHead>
                    <TableHead>{model.ds.deskAdminModeratorName}</TableHead>
                    <TableHead>{model.ds.deskAdminModeratorRole}</TableHead>
                    <TableHead>{model.ds.deskAdminModeratorDistricts}</TableHead>
                    <TableHead>{model.ds.deskAdminModeratorCreated}</TableHead>
                    <TableHead>{workT.workTitle}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.adminModerators.map((moderator) => (
                    <Fragment key={moderator.sub}>
                      <TableRow>
                        <TableCell>{moderator.email}</TableCell>
                        <TableCell>{moderator.name || model.t.unavailable}</TableCell>
                        <TableCell>{moderator.role}</TableCell>
                        <TableCell>{moderator.districts.join(", ") || model.t.deskScopeAll}</TableCell>
                        <TableCell>{formatDateTime(moderator.createdAt, model.language)}</TableCell>
                        <TableCell>
                          <Button type="button" size="sm" variant="secondary" onClick={() => void toggleWork(moderator.sub)} disabled={workLoading[moderator.sub]}>
                            {workLoading[moderator.sub] ? "…" : workT.workTitle}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedWork === moderator.sub && workBySub[moderator.sub] ? (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <WorkTally data={workBySub[moderator.sub]} t={workT} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </SectionFrame>
  );
}
