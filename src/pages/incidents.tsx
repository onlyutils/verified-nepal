import { useEffect, useState } from "react";
import { Search, Share2 } from "lucide-react";
import { listIncidents, type Incident } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { disasterStrings } from "@/i18n/disasters";
import { districtLabels, districtNames, type DistrictName } from "@/lib/geo";
import type { Language } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { ShareButton } from "@/components/share-button";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DistrictPicker } from "@/components/district-picker";
import { formatDateTime } from "@/lib/format-date";

function IncidentCard({ incident, language }: { incident: Incident; language: Language }) {
  const t = disasterStrings[language];
  const displayName = language === "ne" && incident.nameNe ? incident.nameNe : incident.name;
  const displaySummary = language === "ne" && incident.summaryNe ? incident.summaryNe : incident.summary;
  const districtLabelsList = incident.affectedDistricts.map((district) => districtLabels[district][language]);
  const startedLabel = formatDateTime(incident.startedAt, language);
  const shareUrl = `${window.location.origin}/incidents`;
  const shareText = `${displayName} — ${t.incidentsPublicShareTag} ${shareUrl}`;
  const statusLabels = {
    active: t.incidentsPublicStatusActive,
    archived: t.incidentsPublicStatusArchived,
  };

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="gap-3">
        <CardTitle className="text-lg">{displayName}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={toneForStatus(incident.status)}>
            {statusLabels[incident.status as "active" | "archived"]}
          </StatusBadge>
          <Badge variant="outline">{incident.kind}</Badge>
        </div>
      </CardHeader>
      <CardContent className="mt-auto space-y-4">
        {incident.coverImageUrl ? (
          <img src={incident.coverImageUrl} alt={displayName} loading="lazy" className="aspect-video w-full rounded-md object-cover" />
        ) : null}
        {displaySummary ? <p className="text-sm leading-6 text-muted-foreground">{displaySummary}</p> : null}
        {districtLabelsList.length ? (
          <div className="flex flex-wrap gap-2">
            {districtLabelsList.map((district) => (
              <Badge key={district} variant="secondary">
                {district}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">{startedLabel}</p>
        <div className="mt-auto space-y-3 pt-2">
          <ShareButton
            filename={`verifiednepal-incident-${incident.id}.png`}
            headline={displayName}
            subline={[incident.kind, districtLabelsList.join(", ")].filter(Boolean).join(" · ")}
            message={displaySummary}
            footnote={startedLabel}
            labels={{
              download: t.incidentsPublicDownloadPoster,
              share: t.incidentsPublicSharePoster,
              exportError: t.incidentsPublicShareError,
            }}
          />
          <div className="flex flex-wrap gap-2">
            {incident.sourceAttribution ? (
              <Button asChild variant="outline" size="sm">
                <a href={incident.sourceAttribution.url} target="_blank" rel="noopener noreferrer">
                  {incident.sourceAttribution.label || t.incidentsPublicViewSource}
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
                <Share2 aria-hidden="true" />
                WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Share2 aria-hidden="true" />
                Facebook
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IncidentsPage({ language }: { language: Language }) {
  const t = disasterStrings[language];
  const [items, setItems] = useState<Incident[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<DistrictName[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listIncidents("active,archived")
      .then((response) => {
        if (!cancelled) setItems(response.items);
      })
      .catch((cause) => {
        if (!cancelled) setError(apiErrorMessage(cause, language));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const query = search.trim().toLowerCase();
  const filtered = items
    .filter((incident) => !selectedDistricts.length || incident.affectedDistricts.some((district) => selectedDistricts.includes(district)))
    .filter((incident) => {
      if (!query) return true;
      const name = (language === "ne" && incident.nameNe ? incident.nameNe : incident.name).toLowerCase();
      const districtMatch = incident.affectedDistricts.some((district) => districtLabels[district][language].toLowerCase().includes(query));
      return name.includes(query) || districtMatch;
    });
  const sorted = [...filtered].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader eyebrow={t.incidentsPublicEyebrow} title={t.incidentsPublicTitle} description={t.incidentsPublicLead} />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="incidents-search">{t.incidentsPublicSearchLabel}</Label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="incidents-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t.incidentsPublicSearchPlaceholder}
                autoComplete="off"
                className="min-h-11 pl-10"
              />
            </div>
          </div>
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <legend className="text-sm font-medium">{t.incidentsPublicFilterLabel}</legend>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedDistricts([...districtNames])}>
                  {t.incidentsPublicSelectAll}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedDistricts([])}>
                  {t.incidentsPublicClearAll}
                </Button>
              </div>
            </div>
            <DistrictPicker selected={selectedDistricts} onChange={(value) => setSelectedDistricts(value as DistrictName[])} language={language} searchPlaceholder={t.incidentsPublicSearchPlaceholder} />
          </fieldset>
        </CardContent>
      </Card>
      {loading ? <LoadingState label={t.incidentsPublicLoading} /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!loading && !error && !sorted.length ? (
        <EmptyState title={selectedDistricts.length || query ? t.incidentsPublicEmptyFiltered : t.incidentsPublicEmptyAll} />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} language={language} />
        ))}
      </div>
    </div>
  );
}
