import { useState } from "react";
import { requestIncident, presignNeedMedia, type NeedMediaItem } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { useGoogleAuth } from "@/lib/auth";
import { disasterStrings } from "@/i18n/disasters";
import { districtLabels, districtNames, type DistrictName } from "@/lib/geo";
import type { Language } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader } from "@/components/page-header";
import { Textarea } from "@/components/ui/textarea";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_PHOTO_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export function ReportIncident({ language }: { language: Language }) {
  const t = disasterStrings[language];
  const auth = useGoogleAuth();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [district, setDistrict] = useState<DistrictName | "">("");
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<NeedMediaItem[]>([]);
  const [mediaNames, setMediaNames] = useState<Record<string, string>>({});
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleMediaChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setMediaError(null);
    const available = Math.max(0, 2 - media.length);
    const valid = files.filter((file) => {
      const accepted = PHOTO_TYPES.includes(file.type) || VIDEO_TYPES.includes(file.type);
      const size = PHOTO_TYPES.includes(file.type) ? MAX_PHOTO_SIZE : MAX_VIDEO_SIZE;
      if (!accepted) {
        setMediaError(t.reportIncidentInvalidType);
        return false;
      }
      if (file.size <= 0 || file.size > size) {
        setMediaError(t.reportIncidentTooLarge);
        return false;
      }
      if (PHOTO_TYPES.includes(file.type) && media.some((item) => item.type === "photo")) return false;
      if (VIDEO_TYPES.includes(file.type) && media.some((item) => item.type === "video")) return false;
      return true;
    });
    if (files.length > available) setMediaError(t.reportIncidentTooLarge);
    await Promise.all(
      valid.slice(0, available).map(async (file) => {
        try {
          const presign = await presignNeedMedia({ filename: file.name, contentType: file.type, size: file.size });
          const headers = {
            ...(presign.headers || {}),
            ...(presign.headers?.["Content-Type"] || presign.headers?.["content-type"] ? {} : { "Content-Type": file.type }),
          };
          const upload = await fetch(presign.uploadUrl, { method: "PUT", body: file, headers });
          if (!upload.ok) throw new Error("upload");
          const item: NeedMediaItem = { fileId: presign.fileId, type: presign.mediaType, originalUrl: presign.publicUrl };
          setMedia((current) => [...current, item]);
          setMediaNames((current) => ({ ...current, [item.fileId]: file.name }));
        } catch {
          setMediaError(t.reportIncidentMediaUploadError);
        }
      }),
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!auth.idToken) {
      setError(t.reportIncidentSignIn);
      return;
    }
    if (!name.trim() || !kind.trim() || !district || description.trim().length < 10 || !media.some((item) => item.type === "photo")) {
      setError(t.reportIncidentRequired);
      return;
    }
    setSubmitting(true);
    try {
      const response = await requestIncident(
        { name: name.trim(), kind: kind.trim(), district, description: description.trim(), media },
        auth.idToken,
      );
      setSuccess(response.id);
    } catch (cause) {
      setError(apiErrorMessage(cause, language));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow={t.reportIncidentTitle} title={t.reportIncidentTitle} description={t.reportIncidentLead} />
      {!auth.idToken ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.reportIncidentSignIn}</CardTitle>
            <CardDescription>{t.reportIncidentSignInBody}</CardDescription>
          </CardHeader>
          <CardContent>
            {auth.clientId ? (
              <Button type="button" onClick={auth.signIn}>
                {t.reportIncidentSignIn}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">{t.reportIncidentSignInBody}</p>
            )}
          </CardContent>
        </Card>
      ) : success ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.reportIncidentSuccessTitle}</CardTitle>
            <CardDescription>{t.reportIncidentSuccessBody}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm">
              {t.reportIncidentReference}: {success}
            </p>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.reportIncidentTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="incident-name">{t.reportIncidentName} *</Label>
                  <Input id="incident-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={150} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="incident-kind">{t.reportIncidentKind} *</Label>
                  <Input id="incident-kind" value={kind} onChange={(event) => setKind(event.target.value)} maxLength={50} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="incident-district">{t.reportIncidentDistrict} *</Label>
                <NativeSelect id="incident-district" value={district} onChange={(event) => setDistrict(event.target.value as DistrictName)}>
                  <NativeSelectOption value="">{t.incidentSelect}</NativeSelectOption>
                  {districtNames.map((item) => (
                    <NativeSelectOption key={item} value={item}>
                      {districtLabels[item][language]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="incident-description">{t.reportIncidentDescription} *</Label>
                <Textarea
                  id="incident-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder={t.reportIncidentDescriptionHint}
                />
                <p className="text-sm text-muted-foreground">{t.reportIncidentDescriptionHint}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="incident-media">{t.reportIncidentPhoto}</Label>
                <FileInput
                  id="incident-media"
                  language={language}
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                  multiple
                  onChange={handleMediaChange}
                  disabled={submitting || media.length >= 2}
                />
                <p className="text-sm text-muted-foreground">{t.reportIncidentMediaHint}</p>
                {mediaError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {mediaError}
                  </p>
                ) : null}
                {media.length ? (
                  <ul className="space-y-2 text-sm">
                    {media.map((item) => (
                      <li key={item.fileId} className="rounded-md border px-3 py-2">
                        {mediaNames[item.fileId] || item.fileId} · {item.type === "photo" ? t.reportIncidentPhoto : t.reportIncidentVideo}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </CardContent>
          </Card>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? t.reportIncidentSubmitting : t.reportIncidentSubmit}
          </Button>
        </form>
      )}
    </div>
  );
}
