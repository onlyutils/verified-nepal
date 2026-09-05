import { useState } from "react";
import { ApiError, attachProjectPhoto, createProjectUpdate, presignProjectPhoto } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { communityStrings } from "@/i18n/community";
import { downscaleImage } from "@/lib/image";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fillTemplate } from "@/lib/edition";

function extractProjectId(input: string) {
  const value = input.trim();
  if (!value) return "";
  try {
    if (value.includes("://")) {
      const parts = new URL(value).pathname.split("/").filter(Boolean);
      const index = parts.indexOf("projects");
      if (index >= 0 && parts[index + 1]) return parts[index + 1];
      if (parts.length) return parts[parts.length - 1];
    }
  } catch {
    /* use plain id */
  }
  return value.split("?")[0].split("#")[0].split("/").filter(Boolean).pop() || value;
}

export function ProjectUpdate({ language }: { language: Language }) {
  const t = communityStrings[language];
  const [projectInput, setProjectInput] = useState("");
  const [updateCode, setUpdateCode] = useState("");
  const [text, setText] = useState("");
  const [spent, setSpent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [offline, setOffline] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setOffline(false);
    const projectId = extractProjectId(projectInput);
    if (!projectId || !updateCode.trim() || !text.trim()) {
      setError(t.updateError);
      return;
    }
    if (!navigator.onLine) {
      setOffline(true);
      setError(t.updateOffline);
      return;
    }
    const spentNumber = spent.trim() ? Number(spent) : undefined;
    if (spent.trim() && (!Number.isFinite(spentNumber) || spentNumber! < 0)) {
      setError(t.validationRequired);
      return;
    }
    setSubmitting(true);
    setSuccess(false);
    try {
      const photoFileIds: string[] = [];
      if (files.length) {
        setProgress({ done: 0, total: files.length });
        for (let index = 0; index < files.length; index += 1) {
          const original = files[index];
          if (!["image/jpeg", "image/png", "image/webp"].includes(original.type) || original.size > 8 * 1024 * 1024)
            throw new Error(t.updateError);
          const resized = await downscaleImage(original, 1600);
          if (resized.size > 8 * 1024 * 1024) throw new Error(t.updateError);
          const presign = await presignProjectPhoto(
            projectId,
            { filename: resized.name, contentType: resized.type, size: resized.size },
            { updateCode: updateCode.trim() },
          );
          const headers = {
            ...(presign.headers || {}),
            ...(presign.headers?.["Content-Type"] || presign.headers?.["content-type"] ? {} : { "Content-Type": resized.type }),
          };
          const upload = await fetch(presign.uploadUrl, { method: "PUT", body: resized, headers });
          if (!upload.ok) throw new Error(t.updateError);
          await attachProjectPhoto(projectId, { fileId: presign.fileId, url: presign.publicUrl }, { updateCode: updateCode.trim() });
          photoFileIds.push(presign.fileId);
          setProgress({ done: index + 1, total: files.length });
        }
      }
      await createProjectUpdate(projectId, { text: text.trim(), photoFileIds, spentNpr: spentNumber }, updateCode.trim());
      setSuccess(true);
      setFiles([]);
      setText("");
      setSpent("");
      setProgress(null);
    } catch (cause) {
      const api = cause as ApiError;
      setOffline(api.status === 0 || !navigator.onLine);
      setError(api.status === 0 || !navigator.onLine ? t.updateOffline : apiErrorMessage(cause, language));
      setProgress(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow={t.communityEyebrow} title={t.projectUpdateTitle} description={t.projectUpdateLead} />
      {success ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t.updateSuccess}</span>
            <Button asChild variant="link" className="h-auto p-0">
              <a href={`/projects/${encodeURIComponent(extractProjectId(projectInput))}`}>{t.viewProject}</a>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.projectUpdateTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="update-project">{t.projectId} *</Label>
              <Input
                id="update-project"
                value={projectInput}
                onChange={(e) => setProjectInput(e.target.value)}
                placeholder={t.projectIdHint}
                required
              />
              <p className="text-sm text-muted-foreground">{t.projectIdHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="update-code">{t.updateCodeField} *</Label>
              <Input id="update-code" value={updateCode} onChange={(e) => setUpdateCode(e.target.value)} className="font-mono" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="update-text">{t.updateText} *</Label>
              <Textarea id="update-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={7} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="update-spent">{t.spentAmount}</Label>
              <Input id="update-spent" type="number" inputMode="decimal" min={0} value={spent} onChange={(e) => setSpent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="update-photos">{t.updatePhotos}</Label>
              <FileInput
                id="update-photos"
                language={language}
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}
              />
              <p className="text-sm text-muted-foreground">{t.updatePhotosHint}</p>
              {files.length ? (
                <ul className="divide-y rounded-lg border">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 break-all">
                        {file.name} · {fillTemplate(t.fileSize, { size: (file.size / 1024).toFixed(0) })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        {t.remove}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t.noPhotosSelected}</p>
              )}
            </div>
            {progress ? (
              <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                {fillTemplate(t.uploading, { done: String(progress.done), total: String(progress.total) })}
              </p>
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {error}
                  {offline ? ` ${t.offline}` : ""}
                </AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" size="lg" disabled={submitting} className="w-full">
              {submitting ? t.updateSubmitting : t.updateSubmit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
