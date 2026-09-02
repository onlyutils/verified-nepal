import { apiErrorMessage } from "@/lib/api-error";
import { useEffect, useState } from "react";
import { ApiError, getProject, type ProjectDetailResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { districtLabels } from "@/lib/geo";
import { labels } from "@/i18n";
import type { Language } from "@/lib/types";
import { formatNumber, formatDateTime } from "@/lib/format";
import { fillTemplate } from "@/lib/edition";

export function ProjectDetail({ language, id }: { language: Language; id: string }) {
  const t = labels[language] as Record<string,string>;
  const [project, setProject] = useState<ProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [copied, setCopied] = useState<string|null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    setError(null);
    setOffline(false);
    getProject(id).then(p=>{
      if (!cancelled) { setProject(p); setLoading(false); }
    }).catch(e=>{
      if (cancelled) return;
      const err = e as ApiError;
      if (err.status===0 || !navigator.onLine) { setOffline(true); setError(t.projectDetailError); }
      else if (err.status===404) setError(t.projectDetailNotFound);
      else setError(apiErrorMessage(err, language));
      setLoading(false);
    });
    return ()=>{ cancelled=true };
  },[id, t.projectDetailError, t.projectDetailNotFound]);

  if (loading) return <p className="font-sans text-sm text-muted-foreground-foreground">{t.projectDetailLoading}</p>;
  if (error) return <div className="border border-rule bg-card px-4 py-6" role="alert"><p className="font-sans text-sm text-destructive">{error}</p>{offline ? <p className="mt-1 font-sans text-xs text-muted-foreground-foreground">{t.projectsOffline}</p> : null}<div className="mt-4"><a href="/projects" className="font-sans text-sm underline">{t.projectDetailBack}</a></div></div>;
  if (!project) return <p className="font-sans text-sm text-muted-foreground-foreground">{t.projectDetailNotFound}</p>;

  const title = language==='ne' ? (project.title.ne || project.title.en) : project.title.en;
  const desc = language==='ne' ? (project.description.ne || project.description.en) : project.description.en;
  const url = `${window.location.origin}/projects/${encodeURIComponent(project.id)}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(url)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(()=>setCopied(null),2000); } catch {}
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <a href="/projects" className="font-sans text-sm underline">{t.projectDetailBack}</a>
      <header className="border-b border-rule pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="uppercase">{project.type}</Badge>
          <Badge>{project.status}</Badge>
          {project.committee.verified ? <Badge variant="default">{t.projectDetailVerifiedBadge}</Badge> : <Badge variant="outline">{t.projectDetailNotVerified}</Badge>}
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight">{title}</h1>
        <p className="mt-2 font-sans text-sm text-muted-foreground-foreground">{districtLabels[project.district as keyof typeof districtLabels]?.[language] ?? project.district} · W{project.ward} · {project.locationText} · {fillTemplate(t.projectsCostNpr,{amount: formatNumber(project.costEstimateNpr, language)})}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">{t.projectDetailGallery}</CardTitle></CardHeader>
            <CardContent>
              {project.photos.length===0 ? <p className="font-sans text-sm text-muted-foreground-foreground">{t.projectDetailNoPhotos}</p> :
                <div className="grid grid-cols-2 gap-2">
                  {project.photos.map(ph=> <img key={ph.fileId} src={ph.url} alt={ph.caption || t.projectDetailPhotos} className="h-44 w-full object-cover border border-rule" loading="lazy" />)}
                </div>
              }
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{t.projectDetailDescription}</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap font-serif text-base leading-7">{desc}</p></CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">{t.projectDetailUpdatesTitle}</CardTitle><span className="font-sans text-xs text-muted-foreground-foreground">{project.updates.length}</span></CardHeader>
            <CardContent className="space-y-4">
              {project.updates.length===0 ? <p className="font-sans text-sm text-muted-foreground-foreground">{t.projectDetailNoUpdates}</p> :
                project.updates.slice().sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(u=>(
                  <div key={u.id} className="border border-rule bg-card p-4">
                    <p className="font-sans text-xs text-muted-foreground-foreground">{formatDateTime(u.createdAt, language)} {u.spentNpr!=null ? `· ${fillTemplate(t.projectDetailSpentNpr,{amount: formatNumber(u.spentNpr, language)})}` : ""}</p>
                    <p className="mt-2 whitespace-pre-wrap font-serif text-sm leading-6">{u.text}</p>
                    {u.photos && u.photos.length>0 ? <div className="mt-3 grid grid-cols-3 gap-2">{u.photos.map(ph=> <img key={ph.fileId} src={ph.url} alt={ph.caption||""} className="h-28 w-full object-cover border border-rule" loading="lazy" />)}</div> : null}
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-ink">
            <CardHeader>
              <CardTitle className="text-base">{t.projectDetailSupportTitle}</CardTitle>
              {project.committee.verified ? <p className="font-sans text-xs font-semibold uppercase tracking-wide text-blue">{t.projectDetailVerifiedBadge}</p> : <p className="font-sans text-xs uppercase tracking-wide text-muted-foreground-foreground">{t.projectDetailNotVerified}</p>}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-sans text-xs uppercase tracking-wide text-muted-foreground-foreground">{t.projectDetailCommittee}</p>
                <p className="font-sans text-sm font-semibold">{project.committee.name}</p>
              </div>
              {project.committee.verified ? (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="font-sans text-xs font-semibold uppercase tracking-wide">{t.projectDetailBank}</p>
                    <div className="space-y-1 font-sans text-sm">
                      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground-foreground">{t.projectDetailBankName}:</span><span className="font-medium">{project.committee.bank.bankName}</span><Button variant="outline" size="sm" onClick={()=>copy(project.committee.bank.bankName,'bankName')}>{copied==='bankName' ? t.projectDetailCopied : t.projectDetailCopy}</Button></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground-foreground">{t.projectDetailAccountName}:</span><span className="font-medium">{project.committee.bank.accountName}</span><Button variant="outline" size="sm" onClick={()=>copy(project.committee.bank.accountName,'accName')}>{copied==='accName' ? t.projectDetailCopied : t.projectDetailCopy}</Button></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground-foreground">{t.projectDetailAccountNumber}:</span><span className="font-mono text-sm font-medium">{project.committee.bank.accountNumber}</span><Button variant="outline" size="sm" onClick={()=>copy(project.committee.bank.accountNumber,'accNum')}>{copied==='accNum' ? t.projectDetailCopied : t.projectDetailCopy}</Button></div>
                    </div>
                    {project.committee.esewaId ? <div className="flex items-center justify-between gap-2 font-sans text-sm"><span className="text-muted-foreground-foreground">{t.projectDetailEsewa}:</span><span className="font-mono font-medium">{project.committee.esewaId}</span><Button variant="outline" size="sm" onClick={()=>copy(project.committee.esewaId!,'esewa')}>{copied==='esewa' ? t.projectDetailCopied : t.projectDetailCopy}</Button></div> : null}
                    {project.committee.khaltiId ? <div className="flex items-center justify-between gap-2 font-sans text-sm"><span className="text-muted-foreground-foreground">{t.projectDetailKhalti}:</span><span className="font-mono font-medium">{project.committee.khaltiId}</span><Button variant="outline" size="sm" onClick={()=>copy(project.committee.khaltiId!,'khalti')}>{copied==='khalti' ? t.projectDetailCopied : t.projectDetailCopy}</Button></div> : null}
                  </div>
                </>
              ) : <p className="font-sans text-xs text-muted-foreground-foreground">{t.projectsPaymentPending}</p>}
              <div className="border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="font-sans text-xs leading-5 text-amber-900">{t.projectDetailHonestLine}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t.projectDetailShareTitle}</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={()=>copy(url,'share')}>{copied==='share' ? t.projectsShareCopied : t.projectsShareCopy}</Button>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center border border-rule bg-paper px-3 font-sans text-xs font-semibold uppercase tracking-wide hover:border-ink">{t.projectsShareWhatsapp}</a>
              <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center border border-rule bg-paper px-3 font-sans text-xs font-semibold uppercase tracking-wide hover:border-ink">{t.projectsShareFacebook}</a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
