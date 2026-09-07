import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import {
  createAssignment,
  createOrgLog,
  getHandover,
  getHandoverCsv,
  listAssignments,
  listOrgDistributions,
  listOrgLog,
  listOrgMembers,
  listOrgNeeds,
  updateAssignmentStatus,
  type ActivityLogEntry,
  type Assignment,
  type AssignmentStatus,
  type CreateAssignmentBody,
  type Distribution,
  type OrgMember,
  type OrgNeed,
} from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format-date";
import { workStrings } from "@/i18n/org-work";
import type { OrgController } from "./org-types";

const today = () => new Date().toISOString().slice(0, 10);
const statusOrder: Record<AssignmentStatus, number> = { assigned: 0, en_route: 1, on_site: 2, done: 3, cancelled: 4 };

type TargetType = "need" | "distribution" | "site";
type FormState = {
  assigneeSub: string;
  targetType: TargetType;
  targetId: string;
  siteLabel: string;
  task: string;
};

const emptyForm = (): FormState => ({ assigneeSub: "", targetType: "need", targetId: "", siteLabel: "", task: "" });

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function targetLabel(assignment: Assignment, needs: OrgNeed[], distributions: Distribution[]) {
  if (assignment.siteLabel) return assignment.siteLabel;
  if (assignment.needId) return needs.find((need) => need.id === assignment.needId)?.description ?? assignment.needId;
  if (assignment.distributionId)
    return distributions.find((item) => item.id === assignment.distributionId)?.plannedDate ?? assignment.distributionId;
  return "";
}

function statusLabel(t: Record<string, string>, status: AssignmentStatus) {
  return t[status] ?? status;
}

function WorkForm({
  open,
  onOpenChange,
  form,
  setForm,
  members,
  needs,
  distributions,
  date,
  shift,
  language,
  onSubmit,
  saving,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormState;
  setForm: (update: (current: FormState) => FormState) => void;
  members: OrgMember[];
  needs: OrgNeed[];
  distributions: Distribution[];
  date: string;
  shift: "day" | "night";
  language: "en" | "ne";
  onSubmit: () => void;
  saving: boolean;
  error: string | null;
}) {
  const t = workStrings[language];
  const acceptedMembers = members.filter((member) => member.status === "member" && member.sub);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.assignTask}</DialogTitle>
          <DialogDescription>
            {date} · {shift === "day" ? t.day : t.night}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="work-member">{t.member}</Label>
            <NativeSelect
              id="work-member"
              value={form.assigneeSub}
              onChange={(event) => setForm((current) => ({ ...current, assigneeSub: event.target.value }))}
            >
              <NativeSelectOption value="">{t.selectMember}</NativeSelectOption>
              {acceptedMembers.map((member) => (
                <NativeSelectOption key={member.sub} value={member.sub}>
                  {member.name || member.email}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {!acceptedMembers.length ? <p className="text-sm text-muted-foreground">{t.noMembers}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="work-target-type">{t.target}</Label>
            <NativeSelect
              id="work-target-type"
              value={form.targetType}
              onChange={(event) =>
                setForm((current) => ({ ...current, targetType: event.target.value as TargetType, targetId: "", siteLabel: "" }))
              }
            >
              <NativeSelectOption value="need">{t.need}</NativeSelectOption>
              <NativeSelectOption value="distribution">{t.distribution}</NativeSelectOption>
              <NativeSelectOption value="site">{t.site}</NativeSelectOption>
            </NativeSelect>
          </div>
          {form.targetType === "need" ? (
            <div className="space-y-2">
              <Label htmlFor="work-need">{t.need}</Label>
              <NativeSelect
                id="work-need"
                value={form.targetId}
                onChange={(event) => setForm((current) => ({ ...current, targetId: event.target.value }))}
              >
                <NativeSelectOption value="">{t.selectNeed}</NativeSelectOption>
                {needs
                  .filter((need) => need.status === "matched")
                  .map((need) => (
                    <NativeSelectOption key={need.id} value={need.id}>
                      {need.description.slice(0, 90)}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </div>
          ) : null}
          {form.targetType === "distribution" ? (
            <div className="space-y-2">
              <Label htmlFor="work-distribution">{t.distribution}</Label>
              <NativeSelect
                id="work-distribution"
                value={form.targetId}
                onChange={(event) => setForm((current) => ({ ...current, targetId: event.target.value }))}
              >
                <NativeSelectOption value="">{t.selectDistribution}</NativeSelectOption>
                {distributions.map((distribution) => (
                  <NativeSelectOption key={distribution.id} value={distribution.id}>
                    {distribution.plannedDate} · {distribution.municipality ?? distribution.municipalityId}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          {form.targetType === "site" ? (
            <div className="space-y-2">
              <Label htmlFor="work-site">{t.site}</Label>
              <Input
                id="work-site"
                value={form.siteLabel}
                onChange={(event) => setForm((current) => ({ ...current, siteLabel: event.target.value }))}
                placeholder={t.sitePlaceholder}
                maxLength={120}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="work-task">{t.task}</Label>
            <Textarea
              id="work-task"
              value={form.task}
              onChange={(event) => setForm((current) => ({ ...current, task: event.target.value }))}
              placeholder={t.taskPlaceholder}
              maxLength={300}
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={onSubmit} disabled={saving || acceptedMembers.length === 0}>
            {saving ? t.saving : t.saveAssignment}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Work({
  controller,
  initialNeedId,
  onInitialNeedHandled,
}: {
  controller: OrgController;
  initialNeedId?: string | null;
  onInitialNeedHandled?: () => void;
}) {
  const { auth, selectedOrg, language } = controller;
  const t = workStrings[language];
  const [date, setDate] = useState(today);
  const [shift, setShift] = useState<"day" | "night">("day");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [needs, setNeeds] = useState<OrgNeed[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activityText, setActivityText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [activityBusy, setActivityBusy] = useState(false);
  const [handoverBusy, setHandoverBusy] = useState(false);

  const load = useCallback(async () => {
    if (!auth.idToken || !selectedOrg) return;
    setLoading(true);
    setError(null);
    try {
      const [assignmentResponse, activityResponse, needResponse, distributionResponse] = await Promise.all([
        listAssignments(auth.idToken, selectedOrg.id, date),
        listOrgLog(auth.idToken, selectedOrg.id, date),
        listOrgNeeds(auth.idToken, selectedOrg.id),
        listOrgDistributions(auth.idToken, selectedOrg.id),
      ]);
      setAssignments(assignmentResponse.items);
      setActivities(activityResponse.items);
      setNeeds(needResponse.items);
      setDistributions(distributionResponse.items);
      try {
        setMembers((await listOrgMembers(auth.idToken, selectedOrg.id)).items);
      } catch {
        if (auth.profile?.sub) {
          setMembers([
            {
              sub: auth.profile.sub,
              email: auth.profile.email ?? "",
              name: auth.profile.name ?? "",
              role: "staff",
              status: "member",
              createdAt: "",
            },
          ]);
        }
      }
    } catch (cause) {
      setError(apiErrorMessage(cause, language));
    } finally {
      setLoading(false);
    }
  }, [auth.idToken, date, language, selectedOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!initialNeedId) return;
    setForm((current) => ({ ...current, targetType: "need", targetId: initialNeedId }));
    setDialogOpen(true);
    onInitialNeedHandled?.();
  }, [initialNeedId, onInitialNeedHandled]);

  useEffect(() => {
    if (form.assigneeSub || !members.length) return;
    const first = members.find((member) => member.status === "member" && member.sub);
    if (first?.sub) setForm((current) => ({ ...current, assigneeSub: first.sub as string }));
  }, [form.assigneeSub, members]);

  const grouped = useMemo(() => {
    const groups = new Map<string, { sub: string; name: string; assignments: Assignment[] }>();
    for (const assignment of assignments) {
      const current = groups.get(assignment.assigneeSub) ?? { sub: assignment.assigneeSub, name: assignment.assigneeName, assignments: [] };
      current.assignments.push(assignment);
      groups.set(assignment.assigneeSub, current);
    }
    return [...groups.values()];
  }, [assignments]);

  const openForm = () => {
    setForm((current) => ({
      ...emptyForm(),
      assigneeSub: current.assigneeSub || members.find((member) => member.status === "member" && member.sub)?.sub || "",
    }));
    setFormError(null);
    setDialogOpen(true);
  };

  const submitAssignment = async () => {
    if (!auth.idToken || !selectedOrg) return;
    const target =
      form.targetType === "need"
        ? { needId: form.targetId }
        : form.targetType === "distribution"
          ? { distributionId: form.targetId }
          : { siteLabel: form.siteLabel.trim() };
    if (!form.assigneeSub || !Object.values(target)[0] || !form.task.trim()) {
      setFormError(t.formError);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body: CreateAssignmentBody = { shiftDate: date, shift, assigneeSub: form.assigneeSub, task: form.task.trim(), ...target };
      await createAssignment(auth.idToken, selectedOrg.id, body);
      setDialogOpen(false);
      await load();
    } catch (cause) {
      setFormError(apiErrorMessage(cause, language));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (assignment: Assignment, status: AssignmentStatus) => {
    if (!auth.idToken || !selectedOrg) return;
    setStatusBusy(assignment.id);
    setError(null);
    try {
      await updateAssignmentStatus(auth.idToken, selectedOrg.id, assignment.id, status);
      await load();
    } catch (cause) {
      setError(apiErrorMessage(cause, language));
    } finally {
      setStatusBusy(null);
    }
  };

  const addActivity = async () => {
    if (!auth.idToken || !selectedOrg) return;
    const text = activityText.trim();
    if (!text) {
      setError(t.activityError);
      return;
    }
    setActivityBusy(true);
    setError(null);
    try {
      await createOrgLog(auth.idToken, selectedOrg.id, { text });
      setActivityText("");
      await load();
    } catch (cause) {
      setError(apiErrorMessage(cause, language));
    } finally {
      setActivityBusy(false);
    }
  };

  const openHandover = async () => {
    if (!auth.idToken || !selectedOrg) return;
    const popup = window.open("", "_blank");
    if (!popup) {
      setError(t.error);
      return;
    }
    setHandoverBusy(true);
    try {
      const [handover, csv] = await Promise.all([
        getHandover(auth.idToken, selectedOrg.id, date, shift),
        getHandoverCsv(auth.idToken, selectedOrg.id, date, shift),
      ]);
      const groups = handover.assignments
        .map(
          (group) =>
            `<section><h2>${escapeHtml(group.assigneeName)}</h2><ul>${group.assignments.map((assignment) => `<li><strong>${escapeHtml(statusLabel(t, assignment.status))}</strong> ${escapeHtml(assignment.task)} (${escapeHtml(targetLabel(assignment, needs, distributions))})</li>`).join("")}</ul></section>`,
        )
        .join("");
      const log = handover.log
        .map(
          (entry) => `<li>${escapeHtml(formatDateTime(entry.at, language))} · ${escapeHtml(entry.byName)}: ${escapeHtml(entry.text)}</li>`,
        )
        .join("");
      const openNeeds = handover.openNeeds.length
        ? `<ul>${handover.openNeeds.map((need) => `<li>${escapeHtml(need.district)} · ${escapeHtml(need.municipality ?? need.municipalityId)} · W${escapeHtml(need.ward)}: ${escapeHtml(need.description)}</li>`).join("")}</ul>`
        : `<p>${escapeHtml(t.handoverNoOpenNeeds)}</p>`;
      const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      popup.document.write(
        `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${escapeHtml(t.handoverTitle)} · ${escapeHtml(handover.orgName)}</title><style>body{font:16px system-ui,sans-serif;max-width:900px;margin:32px auto;padding:0 20px;color:#111}header{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #111;padding-bottom:16px}section{break-inside:avoid;border-bottom:1px solid #ccc;padding:12px 0}a,button{font:inherit} @media print{.actions{display:none}}</style></head><body><header><div><h1>${escapeHtml(t.handoverTitle)}</h1><p>${escapeHtml(handover.orgName)} · ${escapeHtml(handover.date)} · ${escapeHtml(shift === "day" ? t.day : t.night)}</p></div><div class="actions"><a href="${csvHref}" download="verifiednepal-handover-${escapeHtml(date)}-${escapeHtml(shift)}.csv">${escapeHtml(t.handoverDownload)}</a> <button onclick="window.print()">${escapeHtml(t.handoverPrint)}</button></div></header>${groups || `<p>${escapeHtml(t.noAssignments)}</p>`}<section><h2>${escapeHtml(t.handoverOpenNeeds)}</h2>${openNeeds}</section><section><h2>${escapeHtml(t.activity)}</h2><ul>${log || `<li>${escapeHtml(t.noActivity)}</li>`}</ul></section><p>${escapeHtml(t.handoverGenerated)}: ${escapeHtml(formatDateTime(handover.generatedAt, language))}</p></body></html>`,
      );
      popup.document.close();
      popup.focus();
    } catch (cause) {
      popup.close();
      setError(apiErrorMessage(cause, language));
    } finally {
      setHandoverBusy(false);
    }
  };

  if (!selectedOrg) return null;
  if (loading && !assignments.length && !activities.length) return <LoadingState label={t.loading} />;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow={t.nav}
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => void openHandover()} disabled={handoverBusy}>
            {handoverBusy ? (
              t.preparingHandover
            ) : (
              <>
                <ClipboardCheck />
                {t.handover}
              </>
            )}
          </Button>
        }
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Label htmlFor="work-date">{t.date}</Label>
            <Input id="work-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="work-shift">{t.shift}</Label>
            <NativeSelect id="work-shift" value={shift} onChange={(event) => setShift(event.target.value as "day" | "night")}>
              <NativeSelectOption value="day">{t.day}</NativeSelectOption>
              <NativeSelectOption value="night">{t.night}</NativeSelectOption>
            </NativeSelect>
          </div>
          <Button onClick={openForm}>
            <ClipboardCheck />
            {t.assign}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.assignments}</CardTitle>
          <CardDescription>
            {date} · {shift === "day" ? t.day : t.night}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!grouped.length ? (
            <EmptyState icon={ClipboardCheck} title={t.noAssignments} />
          ) : (
            grouped.map((group) => (
              <section key={group.sub} className="space-y-3">
                <h2 className="text-lg font-semibold">{group.name}</h2>
                <div className="space-y-3">
                  {group.assignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">{assignment.task}</p>
                          <p className="text-sm text-muted-foreground">{targetLabel(assignment, needs, distributions)}</p>
                        </div>
                        <StatusBadge tone={toneForStatus(assignment.status)}>{statusLabel(t, assignment.status)}</StatusBadge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(["en_route", "on_site", "done", "cancelled"] as AssignmentStatus[]).map((nextStatus) => {
                          const disabled =
                            statusBusy === assignment.id ||
                            (nextStatus !== "cancelled" &&
                              (assignment.status === "cancelled" || statusOrder[nextStatus] <= statusOrder[assignment.status]));
                          return (
                            <Button
                              key={nextStatus}
                              size="sm"
                              variant={nextStatus === "cancelled" ? "outline" : "secondary"}
                              disabled={disabled}
                              onClick={() => void changeStatus(assignment, nextStatus)}
                            >
                              {statusBusy === assignment.id ? t.statusSaving : statusLabel(t, nextStatus)}
                            </Button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(assignment.statusAt, language)}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.activity}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={activityText}
              onChange={(event) => setActivityText(event.target.value)}
              placeholder={t.activityPlaceholder}
              maxLength={500}
            />
            <Button onClick={() => void addActivity()} disabled={activityBusy}>
              {activityBusy ? t.addingActivity : t.addActivity}
            </Button>
          </div>
          {activities.length ? (
            <ul className="space-y-3">
              {activities.map((entry) => (
                <li key={`${entry.at}-${entry.assignmentId ?? entry.text}`} className="border-b pb-3 text-sm last:border-0">
                  <span className="text-muted-foreground">
                    {formatDateTime(entry.at, language)} · {entry.byName}
                  </span>
                  <br />
                  {entry.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t.noActivity}</p>
          )}
        </CardContent>
      </Card>
      <WorkForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        setForm={setForm}
        members={members}
        needs={needs}
        distributions={distributions}
        date={date}
        shift={shift}
        language={language}
        onSubmit={() => void submitAssignment()}
        saving={saving}
        error={formError}
      />
    </div>
  );
}
