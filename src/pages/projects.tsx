import { useEffect, useState } from "react";
import { ApiError, listProjects, PROJECT_TYPES, type ProjectPublic } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
import { districtLabels, districtNames } from "../geo";
import { labels } from "../i18n";
import { uiStrings } from "../i18n-ui";
import { ProjectStatusMark } from "../ui";
import type { Language } from "../types";
import { formatNumber } from "../utils";
import { apiErrorMessage } from "../api-error";
import { fillTemplate } from "../edition";

function typeLabel(type: string, language: import("../types").Language){
  const u = uiStrings[language];
  const map: Record<string,string> = {
    tuin: u.projectTypeTuin,
    bridge: u.projectTypeBridge,
    trail: u.projectTypeTrail,
    water: u.projectTypeWater,
    school: u.projectTypeSchool,
    other: u.projectTypeOther,
  };
  return map[type] ?? type;
}

function coverUrl(p: ProjectPublic): string | null {
  if (!p.photos || p.photos.length===0) {
    if (typeof p.coverPhoto === 'string') return p.coverPhoto;
    if (p.coverPhoto && typeof p.coverPhoto === 'object' && 'url' in p.coverPhoto) return (p.coverPhoto as {url:string}).url;
    return null;
  }
  const published = p.photos.find(ph=>ph.status==='published');
  if (published) return published.url;
  const any = p.photos[0];
  return any?.url ?? null;
}

export function ProjectsList({ language }: { language: Language }) {
  const t = labels[language] as Record<string,string>;
  const [district, setDistrict] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<ProjectPublic[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [offline, setOffline] = useState(false);

  const fetchList = async (cur?: string, append=false) => {
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const res = await listProjects({ district: district||undefined, status: status||undefined, cursor: cur });
      setItems(prev => append ? [...prev, ...res.items] : res.items);
      setNextCursor(res.cursor);
      setCursor(cur);
    } catch (e) {
      if ((e as ApiError).status===0 || !navigator.onLine) {
        setOffline(true);
        setError(t.projectsOffline);
      } else {
        setError(apiErrorMessage(e, language));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ fetchList(undefined,false); /* eslint-disable-next-line */ }, [district, status]);

  const shareUrlFor = (id: string) => `${window.location.origin}/projects/${encodeURIComponent(id)}`;

  const handleCopy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); } catch {}
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-b border-rule pb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">{t.projectsTitle}</h1>
        <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-muted-foreground">{t.projectsLead}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/projects/register" className="inline-flex h-9 items-center border border-ink bg-ink px-4 font-sans text-xs font-semibold uppercase tracking-wide text-paper hover:bg-ink/90">{t.projectsRegisterCta}</a>
          <a href="/projects/update" className="inline-flex h-9 items-center border border-rule bg-paper px-4 font-sans text-xs font-semibold uppercase tracking-wide text-ink hover:border-ink">{t.projectsUpdateCta}</a>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t.projectsFilters}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="min-w-[12rem]">
            <Label>{t.projectsDistrict}</Label>
            <Select value={district} onChange={e=>setDistrict(e.target.value)}>
              <SelectItem value="">{t.projectsAllDistricts}</SelectItem>
              {districtNames.map(d=> <SelectItem key={d} value={d}>{districtLabels[d as keyof typeof districtLabels][language]}</SelectItem>)}
            </Select>
          </div>
          <div className="min-w-[12rem]">
            <Label>{t.projectsStatus}</Label>
            <Select value={status} onChange={e=>setStatus(e.target.value)}>
              <SelectItem value="">{t.projectsAllStatuses}</SelectItem>
              <SelectItem value="published">published</SelectItem>
              <SelectItem value="in-progress">in-progress</SelectItem>
              <SelectItem value="completed">completed</SelectItem>
            </Select>
          </div>
          <div className="ml-auto flex items-end">
            <Button variant="outline" size="sm" onClick={()=>fetchList(undefined,false)}>{t.projectsTryAgain}</Button>
          </div>
        </CardContent>
      </Card>

      {loading && items.length===0 ? <p className="font-sans text-sm text-muted-foreground">{t.projectsLoading}</p> : null}
      {error ? <div className="border border-rule bg-card px-4 py-4" role="alert"><p className="font-sans text-sm text-destructive">{error}</p>{offline ? <p className="mt-1 font-sans text-xs text-muted-foreground">{t.projectsOffline}</p> : null}</div> : null}
      {!loading && !error && items.length===0 ? <p className="border border-rule bg-card px-4 py-8 text-center font-sans text-sm text-muted-foreground">{t.projectsEmpty}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(p=>{
          const title = language==='ne' ? (p.title.ne || p.title.en) : p.title.en;
          const url = shareUrlFor(p.id);
          const cover = coverUrl(p);
          return (
            <Card key={p.id} className="flex flex-col overflow-hidden">
              {cover ? <img src={cover} alt={t.projectsCoverAlt} className="h-44 w-full object-cover" loading="lazy" /> : <div className="flex h-44 w-full items-center justify-center bg-secondary font-sans text-xs uppercase tracking-wide text-secondary-foreground">{t.projectsNoCover}</div>}
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="uppercase">{typeLabel(p.type, language)}</Badge>
                  <ProjectStatusMark status={p.status} language={language} />
                </div>
                <CardTitle className="line-clamp-2 text-base leading-6">{title}</CardTitle>
                <p className="font-sans text-xs text-muted-foreground">{districtLabels[p.district as keyof typeof districtLabels]?.[language] ?? p.district} · W{p.ward} · {fillTemplate(t.projectsCostNpr,{amount: formatNumber(p.costEstimateNpr, language)})}</p>
              </CardHeader>
              <CardContent className="mt-auto flex flex-wrap gap-2 pt-2">
                <a href={`/projects/${encodeURIComponent(p.id)}`} className="inline-flex h-8 items-center border border-ink bg-ink px-3 font-sans text-xs font-semibold uppercase tracking-wide text-paper hover:bg-ink/90">{t.projectsLearnMore}</a>
                <Button variant="outline" size="sm" onClick={()=>handleCopy(url)}>{t.projectsShareCopy}</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {nextCursor ? <div className="flex justify-center"><Button variant="outline" onClick={()=>fetchList(nextCursor,true)} disabled={loading}>{loading ? t.projectsLoading : t.projectsLoadMore}</Button></div> : null}
    </div>
  );
}
