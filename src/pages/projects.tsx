import { useEffect, useState } from "react";
import { ApiError, listProjects, type ProjectPublic, type ProjectStatus, type ProjectType } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { communityStrings } from "@/i18n/community";
import { districtLabels, districtNames } from "@/lib/geo";
import { useIncidents } from "@/lib/incidents";
import { formatNumber } from "@/lib/format";
import { fillTemplate } from "@/lib/edition";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link2, RefreshCw } from "lucide-react";

function typeLabel(type: ProjectType, language: Language) {
  const t = communityStrings[language];
  const values: Record<ProjectType, string> = {
    tuin: t.projectTypeTuin,
    bridge: t.projectTypeBridge,
    trail: t.projectTypeTrail,
    water: t.projectTypeWater,
    school: t.projectTypeSchool,
    other: t.projectTypeOther,
  };
  return values[type] ?? t.projectTypeOther;
}

function statusLabel(status: ProjectStatus, language: Language) {
  const t = communityStrings[language];
  const values: Record<ProjectStatus, string> = {
    pending: t.statusPending,
    published: t.statusPublished,
    "in-progress": t.statusInProgress,
    completed: t.statusCompleted,
    rejected: t.statusRejected,
    archived: t.statusArchived,
  };
  return values[status] ?? t.statusPending;
}

function coverUrl(project: ProjectPublic): string | null {
  if (project.photos.length) return project.photos.find((photo) => photo.status === "published")?.url ?? project.photos[0]?.url ?? null;
  return typeof project.coverPhoto === "string" ? project.coverPhoto : (project.coverPhoto?.url ?? null);
}

export function ProjectsList({ language }: { language: Language }) {
  const t = communityStrings[language];
  const { incidents, currentIncidentId } = useIncidents();
  const activeIncidents = incidents.filter((incident) => incident.status === "active");
  const boardIncidentId = activeIncidents.some((incident) => incident.id === currentIncidentId)
    ? currentIncidentId
    : activeIncidents[0]?.id;
  const [district, setDistrict] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<ProjectPublic[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchList = async (cursor?: string, append = false) => {
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      if (!boardIncidentId) {
        setItems([]);
        setNextCursor(undefined);
        return;
      }
      const result = await listProjects({
        district: district || undefined,
        status: status || undefined,
        cursor,
        incidentId: boardIncidentId,
      });
      setItems((previous) => (append ? [...previous, ...result.items] : result.items));
      setNextCursor(result.cursor);
    } catch (cause) {
      setError(apiErrorMessage(cause, language));
      setOffline((cause as ApiError).status === 0 || !navigator.onLine);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchList(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [boardIncidentId, district, status]);

  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/projects/${encodeURIComponent(id)}`);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* link remains available */
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow={t.communityEyebrow}
        title={t.projectsTitle}
        description={t.projectsLead}
        actions={
          <>
            <Button asChild>
              <a href="/projects/register">{t.projectsRegister}</a>
            </Button>
            <Button asChild variant="secondary">
              <a href="/projects/update">{t.projectsUpdate}</a>
            </Button>
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.projectsFilters}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="project-district">{t.districtLabel}</Label>
            <NativeSelect id="project-district" value={district} onChange={(event) => setDistrict(event.target.value)}>
              <NativeSelectOption value="">{t.projectsAllDistricts}</NativeSelectOption>
              {districtNames.map((name) => (
                <NativeSelectOption key={name} value={name}>
                  {districtLabels[name][language]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-status">{t.statusLabel}</Label>
            <NativeSelect id="project-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <NativeSelectOption value="">{t.projectsAllStatuses}</NativeSelectOption>
              {(["published", "in-progress", "completed"] as ProjectStatus[]).map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {statusLabel(value, language)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={() => void fetchList()} disabled={loading} className="w-full sm:w-auto">
              <RefreshCw aria-hidden="true" />
              {t.retry}
            </Button>
          </div>
        </CardContent>
      </Card>
      {loading && items.length === 0 ? <LoadingState label={t.projectsLoading} /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            {offline ? ` ${t.offline}` : ""}
          </AlertDescription>
        </Alert>
      ) : null}
      {!loading && !error && items.length === 0 ? <EmptyState title={t.projectsEmpty} description={t.offline} /> : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((project) => {
          const cover = coverUrl(project);
          const districtName = districtLabels[project.district as keyof typeof districtLabels]?.[language] ?? project.district;
          return (
            <Card key={project.id} className="flex min-w-0 flex-col overflow-hidden">
              {cover ? (
                <img src={cover} alt={t.noPhoto} className="aspect-[16/9] w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center bg-secondary px-4 text-center text-sm text-muted-foreground">
                  {t.noPhoto}
                </div>
              )}
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{typeLabel(project.type, language)}</Badge>
                  <StatusBadge tone={toneForStatus(project.status)}>{statusLabel(project.status, language)}</StatusBadge>
                </div>
                <CardTitle className="line-clamp-2 text-lg">
                  {language === "ne" ? project.title.ne || project.title.en : project.title.en}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {fillTemplate(t.districtWard, { district: districtName, ward: String(project.ward) })} ·{" "}
                  {fillTemplate(t.costNpr, { amount: formatNumber(project.costEstimateNpr, language) })}
                </p>
              </CardHeader>
              <CardContent className="mt-auto flex flex-wrap gap-2">
                <Button asChild>
                  <a href={`/projects/${encodeURIComponent(project.id)}`}>{t.projectsDetails}</a>
                </Button>
                <Button type="button" variant="secondary" onClick={() => void copyLink(project.id)}>
                  <Link2 aria-hidden="true" />
                  {copied === project.id ? t.projectsCopied : t.projectsCopyLink}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {nextCursor ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void fetchList(nextCursor, true)} disabled={loading}>
            {t.projectsLoadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
