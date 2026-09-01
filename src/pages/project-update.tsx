import { useState } from "react";
import { ApiError, attachProjectPhoto, createProjectUpdate, presignProjectPhoto } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { labels } from "../i18n";
import type { Language } from "../types";
import { downscaleImage } from "../lib/image";

function extractProjectId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    if (trimmed.includes("://")) {
      const u = new URL(trimmed);
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("projects");
      if (idx !== -1 && parts[idx+1]) return parts[idx+1];
      if (parts.length>0) return parts[parts.length-1];
    }
  } catch {}
  // handles "proj_xxx" or with query
  return trimmed.split("?")[0].split("#")[0].split("/").filter(Boolean).pop() || trimmed;
}

export function ProjectUpdate({ language }: { language: Language }) {
  const t = labels[language] as Record<string,string>;
  const [projectInput, setProjectInput] = useState("");
  const [updateCode, setUpdateCode] = useState("");
  const [text, setText] = useState("");
  const [spent, setSpent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string|null>(null);
  const [progress, setProgress] = useState<{done:number; total:number; phase: string}|null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [offline, setOffline] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>)=>{
    const list = e.target.files;
    if (!list) return;
    const arr = Array.from(list).slice(0,5);
    setFiles(arr);
  };

  const handleSubmit = async (e: React.FormEvent)=>{
    e.preventDefault();
    setError(null);
    setOffline(false);
    const pid = extractProjectId(projectInput);
    if (!pid || !updateCode.trim() || !text.trim()) { setError(t.projectUpdateError); return; }
    if (!navigator.onLine) { setOffline(true); setError(t.projectUpdateOffline); return; }
    setSubmitting(true);
    setSuccess(false);
    try{
      const photoFileIds: string[] = [];
      if (files.length>0) {
        setProgress({done:0, total: files.length, phase: t.projectUpdateUploading});
        for (let i=0;i<files.length;i++) {
          const orig = files[i];
          // validate type and size before downscale (spec: <=8MB after? but check original)
          const allowed = ["image/jpeg","image/png","image/webp"];
          if (!allowed.includes(orig.type)) throw new Error("Invalid image type");
          if (orig.size > 8*1024*1024) throw new Error("Image too large (max 8MB)");
          const downscaled = await downscaleImage(orig, 1600);
          if (downscaled.size > 8*1024*1024) throw new Error("Image still too large after downscale");
          // presign
          const presign = await presignProjectPhoto(pid, { filename: downscaled.name, contentType: downscaled.type, size: downscaled.size }, { updateCode: updateCode.trim() });
          // PUT to uploadUrl with headers
          const putHeaders: Record<string,string> = { ...(presign.headers || {}) };
          // Ensure content-type
          if (!putHeaders["Content-Type"] && !putHeaders["content-type"]) putHeaders["Content-Type"] = downscaled.type;
          const putRes = await fetch(presign.uploadUrl, { method: "PUT", body: downscaled, headers: putHeaders });
          if (!putRes.ok) throw new Error(t.projectUpdatePresignError);
          // attach
          await attachProjectPhoto(pid, { fileId: presign.fileId, url: presign.publicUrl }, { updateCode: updateCode.trim() });
          photoFileIds.push(presign.fileId);
          setProgress({done: i+1, total: files.length, phase: t.projectUpdateUploading});
        }
      }
      const spentNum = spent.trim() ? Number(spent) : undefined;
      if (spent.trim() && (spentNum==null || Number.isNaN(spentNum) || spentNum<0)) { throw new Error("Invalid spent amount"); }
      await createProjectUpdate(pid, { text: text.trim(), photoFileIds, spentNpr: spentNum }, updateCode.trim());
      setSuccess(true);
      setProgress(null);
      setFiles([]);
      setText("");
      setSpent("");
    } catch(e){
      const err = e as ApiError | Error;
      const msg = (err as ApiError).message || (err as Error).message || t.projectUpdateError;
      if ((err as ApiError).status===0 || !navigator.onLine) { setOffline(true); setError(t.projectUpdateOffline); }
      else setError(msg);
      setProgress(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="border-b border-rule pb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">{t.projectUpdateTitle}</h1>
        <p className="mt-2 font-sans text-sm leading-6 text-muted-foreground">{t.projectUpdateLead}</p>
      </header>

      {success ? <div className="border border-green-200 bg-green-50 px-4 py-4"><p className="font-sans text-sm text-green-800">{t.projectUpdateSuccess}</p><div className="mt-3"><a href={`/projects/${encodeURIComponent(extractProjectId(projectInput))}`} className="font-sans text-sm underline">{t.projectsViewProject}</a></div></div> : null}

      <Card>
        <CardHeader><CardTitle className="text-base">{t.projectUpdateTitle}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="pid">{t.projectUpdateProjectId} *</Label>
              <Input id="pid" value={projectInput} onChange={e=>setProjectInput(e.target.value)} placeholder={t.projectUpdateProjectIdHint} required />
              <p className="mt-1 font-sans text-xs text-muted-foreground">{t.projectUpdateProjectIdHint}</p>
            </div>
            <div>
              <Label htmlFor="code">{t.projectUpdateCodeLabel} *</Label>
              <Input id="code" value={updateCode} onChange={e=>setUpdateCode(e.target.value)} required placeholder="e.g. AB2D4FGH..." />
            </div>
            <div>
              <Label htmlFor="utext">{t.projectUpdateTextLabel} *</Label>
              <Textarea id="utext" value={text} onChange={e=>setText(e.target.value)} required rows={4} maxLength={2000} />
            </div>
            <div>
              <Label htmlFor="spent">{t.projectUpdateSpentLabel}</Label>
              <Input id="spent" type="number" min={0} value={spent} onChange={e=>setSpent(e.target.value)} />
            </div>
            <div>
              <Label>{t.projectUpdatePhotosLabel}</Label>
              <Input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFileChange} />
              <p className="mt-1 font-sans text-xs text-muted-foreground">{t.projectUpdatePhotosHint}</p>
              {files.length>0 ? (
                <ul className="mt-2 space-y-2">
                  {files.map((f,idx)=>(
                    <li key={idx} className="flex items-center justify-between border border-rule px-3 py-2">
                      <span className="font-sans text-xs truncate">{f.name} · {(f.size/1024).toFixed(0)}KB · {f.type}</span>
                      <Button variant="ghost" size="sm" type="button" onClick={()=> setFiles(prev=> prev.filter((_,i)=>i!==idx))}>{t.projectUpdateRemove}</Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 font-sans text-xs text-muted-foreground">{t.projectUpdateNoPhotos}</p>}
            </div>

            {progress ? <p className="font-sans text-sm text-muted-foreground" aria-live="polite">{progress.phase}: {progress.done}/{progress.total}</p> : null}
            {error ? <p className="font-sans text-sm text-destructive" role="alert">{error}{offline ? ` · ${t.projectsOffline}` : ""}</p> : null}

            <Button type="submit" disabled={submitting} className="w-full">{submitting ? t.projectUpdateSubmitting : t.projectUpdateSubmit}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
