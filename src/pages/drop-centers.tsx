import { lazy, Suspense, useEffect, useState } from "react";
import { listCenters, type CenterPublic } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { centerStrings } from "@/i18n/centers";
import { districtCenters, districtLabels, districtNames } from "@/lib/geo";
import { goodsLabel } from "@/lib/goods";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Headline, SectionLabel, Standfirst, SquareButton, StatusMark } from "@/components/legacy";
import type { Language, Page } from "@/lib/types";
import { fillTemplate } from "@/lib/edition";

function tierLabel(tier: string | undefined, language: Language): string {
  const s = centerStrings[language];
  if (tier === "known") return s.tierKnown;
  if (tier === "vouched") return s.tierVouched;
  return s.tierSelfDeclared;
}

function statusTone(status: string): "published" | "pending" | "archived" {
  if (status === "open") return "published";
  if (status === "paused") return "pending";
  return "archived";
}

function statusLabel(status: string, language: Language): string {
  const s = centerStrings[language];
  if (status === "open") return s.statusOpen;
  if (status === "paused") return s.statusPaused;
  return s.statusClosed;
}

const CentersMap = lazy(async () => {
  const [{ MapContainer, TileLayer, Marker, Tooltip }, Lmod] = await Promise.all([
    import("react-leaflet"),
    import("leaflet"),
  ]);
  await import("leaflet/dist/leaflet.css");
  const L = Lmod.default;
  function makeDropIcon() {
    return L.divIcon({
      className: "vn-drop-pin",
      html: `<span style="display:block;width:28px;height:28px;color:#DC143C"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 2C7 8 4 11 4 14.5a8 8 0 0 0 16 0C20 11 17 8 12 2Z" fill="currentColor"/></svg></span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
  }
  function CentersMapInner({ centers, district }: { centers: CenterPublic[]; district: string }) {
    const withCoords = centers.filter((c) => typeof c.lat === "number" && typeof c.lng === "number");
    if (withCoords.length === 0) return null;
    let center: [number, number] = [27.7, 85.3];
    if (district && (districtCenters as Record<string, [number, number]>)[district]) {
      const avgLat = withCoords.reduce((s, c) => s + (c.lat as number), 0) / withCoords.length;
      const avgLng = withCoords.reduce((s, c) => s + (c.lng as number), 0) / withCoords.length;
      center = [avgLat, avgLng];
    } else if (withCoords.length) {
      const avgLat = withCoords.reduce((s, c) => s + (c.lat as number), 0) / withCoords.length;
      const avgLng = withCoords.reduce((s, c) => s + (c.lng as number), 0) / withCoords.length;
      center = [avgLat, avgLng];
    } else if (district && (districtCenters as Record<string, [number, number]>)[district]) {
      center = (districtCenters as Record<string, [number, number]>)[district];
    }
    return (
      <MapContainer center={center} zoom={9} scrollWheelZoom={false} className="h-[420px] w-full border border-rule">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {withCoords.map((c) => (
          <Marker key={c.id} position={[c.lat as number, c.lng as number]} icon={makeDropIcon()}>
            <Tooltip direction="top" offset={[0, -10]}>
              {c.name} · {c.org.name}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    );
  }
  return { default: CentersMapInner };
});

export function DropCenters({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  void navigate;
  const s = centerStrings[language];
  const [district, setDistrict] = useState("");
  const [items, setItems] = useState<CenterPublic[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  const fetchList = async (cur?: string, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCenters({ district: district || undefined, cursor: cur });
      setItems((prev) => (append ? [...prev, ...res.items] : res.items));
      setNextCursor(res.cursor);
    } catch (e) {
      setError(apiErrorMessage(e, language));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(undefined, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  const withCoords = items.filter((c) => typeof c.lat === "number" && typeof c.lng === "number");
  const canShowMap = withCoords.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-b border-rule pb-6">
        <SectionLabel>{s.centersSectionLabel}</SectionLabel>
        <Headline level={1} className="mt-3">
          {s.dropCentersTitle}
        </Headline>
        <Standfirst className="mt-3 max-w-3xl">{s.centersStandfirst}</Standfirst>
      </header>

      <Card>
        <CardContent className="flex flex-wrap gap-4 pt-6">
          <div className="min-w-[16rem]">
            <Label htmlFor="center-district">{s.districtLabel}</Label>
            <NativeSelect id="center-district" value={district} onChange={(e) => setDistrict(e.target.value)} className="min-h-11">
              <NativeSelectOption value="">{s.allDistricts}</NativeSelectOption>
              {districtNames.map((d) => (
                <NativeSelectOption key={d} value={d}>
                  {districtLabels[d][language]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {canShowMap ? (
            <div className="ml-auto flex items-end">
              <SquareButton onClick={() => setShowMap((v) => !v)}>{showMap ? s.hideMap : s.showMap}</SquareButton>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {showMap && canShowMap ? (
        <Suspense fallback={<p className="font-sans text-sm text-muted-foreground">{s.loading}</p>}>
          <div className="overflow-hidden border border-rule">
            <CentersMap centers={items} district={district} />
            <p className="border-t border-rule bg-card px-3 py-2 font-sans text-xs text-muted-foreground">{s.mapHelp}</p>
          </div>
        </Suspense>
      ) : null}

      {loading && items.length === 0 ? <p className="font-sans text-sm text-muted-foreground">{s.loading}</p> : null}
      {error ? (
        <div className="border border-rule bg-card px-4 py-4" role="alert">
          <p className="font-sans text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-3 min-h-11" onClick={() => fetchList(undefined, false)}>
            {s.tryAgain}
          </Button>
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="border border-rule bg-card px-4 py-8 text-center font-sans text-sm text-muted-foreground">{district ? s.emptyForDistrict : s.emptyAll}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <Card key={c.id} className="flex flex-col overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-base leading-6">{c.name}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-sans text-xs text-muted-foreground">{c.org.name}</span>
                {c.org.status === "verified" ? (
                  <Badge variant="default" className="text-[0.62rem] uppercase">
                    {tierLabel(c.org.tier, language)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-rule text-[0.62rem] uppercase text-muted-foreground">
                    {s.unverifiedOrg}
                  </Badge>
                )}
              </div>
              <CardDescription className="font-sans text-xs">
                {c.ward ? fillTemplate(s.districtWard, { district: districtLabels[c.district as keyof typeof districtLabels]?.[language] ?? c.district, ward: String(c.ward) }) : districtLabels[c.district as keyof typeof districtLabels]?.[language] ?? c.district}
              </CardDescription>
              <p className="font-sans text-xs text-muted-foreground">{c.address}</p>
              {c.hours ? <p className="font-sans text-xs text-muted-foreground">{s.hoursLabel}: {c.hours}</p> : null}
            </CardHeader>
            <CardContent className="mt-auto space-y-3 pt-2">
              {c.accepts.length ? (
                <div>
                  <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">{s.acceptsLabel}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.accepts.map((a) => (
                      <Badge key={a} variant="secondary" className="text-[0.68rem]">
                        {goodsLabel(a, language)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <StatusMark tone={statusTone(c.status)}>{statusLabel(c.status, language)}</StatusMark>
              </div>
              <a
                href={`/drop-centers/${encodeURIComponent(c.id)}`}
                className="inline-flex min-h-11 items-center border border-ink bg-ink px-3 font-sans text-xs font-semibold uppercase tracking-wide text-paper hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-red"
              >
                {s.viewCenter}
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      {nextCursor ? (
        <div className="flex justify-center">
          <Button variant="outline" className="min-h-11" onClick={() => fetchList(nextCursor, true)} disabled={loading}>
            {loading ? s.loading : s.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
