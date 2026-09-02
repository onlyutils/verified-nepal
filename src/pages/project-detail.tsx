import { useEffect, useState } from "react";
import { ApiError, getProject, type ProjectDetailResponse, type ProjectStatus, type ProjectType } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { communityStrings } from "@/i18n/community";
import { districtLabels } from "@/lib/geo";
import { formatDateTime, formatNumber } from "@/lib/format";
import { fillTemplate } from "@/lib/edition";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link2 } from "lucide-react";

function typeLabel(type: ProjectType, language: Language) {
  const t = communityStrings[language];
  return (
    {
      tuin: t.projectTypeTuin,
      bridge: t.projectTypeBridge,
      trail: t.projectTypeTrail,
      water: t.projectTypeWater,
      school: t.projectTypeSchool,
      other: t.projectTypeOther,
    }[type] ?? t.projectTypeOther
  );
}
function statusLabel(status: ProjectStatus, language: Language) {
  const t = communityStrings[language];
  return (
    {
      pending: t.statusPending,
      published: t.statusPublished,
      "in-progress": t.statusInProgress,
      completed: t.statusCompleted,
      rejected: t.statusRejected,
      archived: t.statusArchived,
    }[status] ?? t.statusPending
  );
}

export function ProjectDetail({ language, id }: { language: Language; id: string }) {
  const t = communityStrings[language];
  const [project, setProject] = useState<ProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      setProject(await getProject(id));
    } catch (cause) {
      const api = cause as ApiError;
      setError(api.status === 404 ? t.projectNotFound : apiErrorMessage(cause, language));
      setOffline(api.status === 0 || !navigator.onLine);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id, language]);

  if (loading) return <LoadingState label={t.projectLoading} />;
  if (error)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            {offline ? ` ${t.offline}` : ""}
            <span className="mt-2 block">
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                {t.retry}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
        <Button asChild variant="secondary">
          <a href="/projects">{t.projectBack}</a>
        </Button>
      </div>
    );
  if (!project)
    return (
      <EmptyState
        title={t.projectNotFound}
        action={
          <Button asChild>
            <a href="/projects">{t.projectBack}</a>
          </Button>
        }
      />
    );

  const title = language === "ne" ? project.title.ne || project.title.en : project.title.en;
  const description = language === "ne" ? project.description.ne || project.description.en : project.description.en;
  const district = districtLabels[project.district as keyof typeof districtLabels]?.[language] ?? project.district;
  const url = `${window.location.origin}/projects/${encodeURIComponent(project.id)}`;
  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* keep text selectable */
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <Button asChild variant="link" className="h-auto min-h-11 px-0">
        <a href="/projects">← {t.projectBack}</a>
      </Button>
      <PageHeader
        eyebrow={t.communityEyebrow}
        title={title}
        description={`${fillTemplate(t.districtWard, { district, ward: String(project.ward) })} · ${project.locationText} · ${fillTemplate(t.costNpr, { amount: formatNumber(project.costEstimateNpr, language) })}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{typeLabel(project.type, language)}</Badge>
            <StatusBadge tone={toneForStatus(project.status)}>{statusLabel(project.status, language)}</StatusBadge>
            <StatusBadge tone={project.committee.verified ? "success" : "neutral"}>
              {project.committee.verified ? t.verified : t.notVerified}
            </StatusBadge>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.projectPhotos}</CardTitle>
            </CardHeader>
            <CardContent>
              {project.photos.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {project.photos.map((photo) => (
                    <img
                      key={photo.fileId}
                      src={photo.url}
                      alt={photo.caption || t.projectPhotos}
                      className="aspect-[4/3] w-full rounded-xl object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
              ) : (
                <EmptyState title={t.noPhoto} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.projectAbout}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-base leading-7">{description}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t.projectUpdates} <span className="text-sm font-normal text-muted-foreground">({project.updates.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.updates.length ? (
                <div className="space-y-6 border-l-2 border-primary pl-4">
                  {project.updates
                    .slice()
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((update) => (
                      <article key={update.id} className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(update.createdAt, language)}
                          {update.spentNpr != null
                            ? ` · ${fillTemplate(t.projectSpent, { amount: formatNumber(update.spentNpr, language) })}`
                            : ""}
                        </p>
                        <p className="whitespace-pre-wrap text-base leading-7">{update.text}</p>
                        {update.photos.length ? (
                          <div className="grid grid-cols-3 gap-2">
                            {update.photos.map((photo) => (
                              <img
                                key={photo.fileId}
                                src={photo.url}
                                alt={photo.caption || t.projectPhotos}
                                className="aspect-square w-full rounded-xl object-cover"
                                loading="lazy"
                              />
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                </div>
              ) : (
                <EmptyState title={t.noUpdates} />
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.projectSupport}</CardTitle>
              <p className="text-sm text-muted-foreground">{project.committee.name}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.committee.verified ? (
                <>
                  <p className="text-sm font-semibold text-primary">{t.verified}</p>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">{t.projectBank}</p>
                    {(
                      [
                        [t.projectBankName, project.committee.bank.bankName, "bank"],
                        [t.projectAccountName, project.committee.bank.accountName, "account"],
                        [t.projectAccountNumber, project.committee.bank.accountNumber, "number"],
                      ] as const
                    ).map(([label, value, key]) => (
                      <div key={key} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="break-all font-medium">{value}</span>
                        <Button variant="secondary" size="sm" onClick={() => void copy(value, key)}>
                          {copied === key ? t.projectsCopied : t.projectCopy}
                        </Button>
                      </div>
                    ))}
                    {project.committee.esewaId ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{t.projectEsewa}</span>
                        <span className="font-mono">{project.committee.esewaId}</span>
                        <Button variant="secondary" size="sm" onClick={() => void copy(project.committee.esewaId!, "esewa")}>
                          {copied === "esewa" ? t.projectsCopied : t.projectCopy}
                        </Button>
                      </div>
                    ) : null}
                    {project.committee.khaltiId ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{t.projectKhalti}</span>
                        <span className="font-mono">{project.committee.khaltiId}</span>
                        <Button variant="secondary" size="sm" onClick={() => void copy(project.committee.khaltiId!, "khalti")}>
                          {copied === "khalti" ? t.projectsCopied : t.projectCopy}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t.projectPaymentPending}</p>
              )}
              <Alert>
                <AlertDescription>{t.projectMoneyWarning}</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.projectShare}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void copy(url, "share")}>
                <Link2 aria-hidden="true" />
                {copied === "share" ? t.projectsCopied : t.projectsCopyLink}
              </Button>
              <Button asChild variant="outline">
                <a href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
                  {t.projectsShareWhatsapp}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.projectsShareFacebook}
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
