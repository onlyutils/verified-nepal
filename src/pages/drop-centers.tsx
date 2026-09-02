import { lazy, Suspense, useEffect, useState } from "react";
import { listCenters, type CenterPublic } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { communityStrings } from "@/i18n/community";
import { centerStrings } from "@/i18n/centers";
import { districtCenters, districtLabels, districtNames } from "@/lib/geo";
import { goodsLabel } from "@/lib/goods";
import type { Language, Page } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

const CentersMap = lazy(async () => {
  const [{ MapContainer, TileLayer, Marker, Tooltip }, leaflet] = await Promise.all([import("react-leaflet"), import("leaflet")]);
  await import("leaflet/dist/leaflet.css");
  const Leaflet = leaflet.default;
  function MapView({ centers }: { centers: CenterPublic[] }) {
    const located = centers.filter((center) => typeof center.lat === "number" && typeof center.lng === "number");
    if (!located.length) return null;
    const center: [number, number] = [
      located.reduce((sum, item) => sum + (item.lat as number), 0) / located.length,
      located.reduce((sum, item) => sum + (item.lng as number), 0) / located.length,
    ];
    const icon = Leaflet.divIcon({
      className: "vn-drop-pin",
      html: '<span style="display:block;width:28px;height:28px;color:rgb(var(--destructive))">●</span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    return (
      <MapContainer center={center} zoom={9} scrollWheelZoom={false} className="h-96 w-full">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {located.map((item) => (
          <Marker key={item.id} position={[item.lat as number, item.lng as number]} icon={icon}>
            <Tooltip>
              {item.name} · {item.org.name}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    );
  }
  return { default: MapView };
});

function statusLabel(status: CenterPublic["status"], language: Language) {
  const s = centerStrings[language];
  return status === "open" ? s.statusOpen : status === "paused" ? s.statusPaused : s.statusClosed;
}
function tierLabel(tier: CenterPublic["org"]["tier"], language: Language) {
  const s = centerStrings[language];
  return tier === "known" ? s.tierKnown : tier === "vouched" ? s.tierVouched : s.tierSelfDeclared;
}

export function DropCenters({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  void navigate;
  const t = communityStrings[language];
  const s = centerStrings[language];
  const [district, setDistrict] = useState("");
  const [items, setItems] = useState<CenterPublic[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const load = async (cursor?: string, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await listCenters({ district: district || undefined, cursor });
      setItems((current) => (append ? [...current, ...response.items] : response.items));
      setNextCursor(response.cursor);
    } catch (cause) {
      setError(apiErrorMessage(cause, language));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [district, language]);
  const located = items.some((item) => typeof item.lat === "number" && typeof item.lng === "number");
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader eyebrow={t.dropCentersEyebrow} title={s.dropCentersTitle} description={s.centersStandfirst} />
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="min-w-56 space-y-2">
            <Label htmlFor="center-district">{s.districtLabel}</Label>
            <NativeSelect id="center-district" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <NativeSelectOption value="">{s.allDistricts}</NativeSelectOption>
              {districtNames.map((name) => (
                <NativeSelectOption key={name} value={name}>
                  {districtLabels[name][language]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {located ? (
            <Button variant="outline" onClick={() => setShowMap((value) => !value)}>
              {showMap ? t.centersHideMap : t.centersShowMap}
            </Button>
          ) : null}
        </CardContent>
      </Card>
      {showMap && located ? (
        <Card>
          <CardContent className="overflow-hidden p-0">
            <Suspense fallback={<LoadingState label={t.centersLoading} />}>
              <CentersMap centers={items} />
            </Suspense>
            <p className="border-t px-5 py-3 text-sm text-muted-foreground">{t.centersMapHelp}</p>
          </CardContent>
        </Card>
      ) : null}
      {loading && !items.length ? <LoadingState label={t.centersLoading} /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            <span className="mt-2 block">
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                {t.retry}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
      {!loading && !error && !items.length ? <EmptyState title={district ? t.centersDistrictEmpty : t.centersEmpty} /> : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((center) => {
          const districtName = districtLabels[center.district as keyof typeof districtLabels]?.[language] ?? center.district;
          return (
            <Card key={center.id} className="flex min-w-0 flex-col">
              <CardHeader className="gap-3">
                <CardTitle className="text-lg">{center.name}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">{center.org.name}</span>
                  <Badge variant={center.org.status === "verified" ? "info" : "outline"}>
                    {center.org.status === "verified" ? tierLabel(center.org.tier, language) : t.centerUnverified}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {center.ward ? `${districtName} · ${s.wardLabel.replace("{ward}", String(center.ward))}` : districtName}
                </p>
                <p className="text-sm text-muted-foreground">{center.address}</p>
                {center.hours ? (
                  <p className="text-sm text-muted-foreground">
                    {s.hoursLabel}: {center.hours}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="mt-auto space-y-4">
                {center.accepts.length ? (
                  <div>
                    <p className="text-sm font-semibold">{s.acceptsLabel}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {center.accepts.map((category) => (
                        <Badge key={category} variant="secondary">
                          {goodsLabel(category, language)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                <StatusBadge tone={toneForStatus(center.status === "paused" ? "limited" : center.status)}>
                  {statusLabel(center.status, language)}
                </StatusBadge>
                <Button asChild className="w-full">
                  <a href={`/drop-centers/${encodeURIComponent(center.id)}`}>{t.viewCenter}</a>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {nextCursor ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void load(nextCursor, true)} disabled={loading}>
            {t.centersLoadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
