import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Plus, Share2 } from "lucide-react";
import { posterStrings } from "@/i18n/poster";
import { labels } from "@/i18n";
import { districtLabels, districtNames } from "@/lib/geo";
import { downscaleImage } from "@/lib/image";
import { apiErrorMessage } from "@/lib/api-error";
import { getDashboard, presignMissingPhoto, putMissing, type MissingBody, type MyMissing } from "@/lib/api";
import { PosterGrid, posterEditPath } from "@/components/poster-grid";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { useGoogleAuth } from "@/lib/auth";
import { uploadMedia } from "@/lib/media";
import { EMPTY_POSTER, POSTER_LIMITS, posterFilename, validatePoster, type PosterInput } from "@/lib/poster";
import { drawPoster, loadPosterFonts, type PosterAssets } from "@/lib/poster-draw";
import type { Language, Page } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { SignInNudge } from "@/components/sign-in-nudge";

const DRAFT_KEY = "vn:poster-draft";
type Draft = { input: PosterInput; photo: string | null };

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage can fill up with a large photo. Keep the text draft and drop the photo.
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, photo: null }));
    } catch {
      // The browser may have storage disabled entirely.
    }
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (src.startsWith("http")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}


/** Pick one option from visual tiles instead of a dropdown. */
function TileRadio<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; title: string; hint?: string; preview: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium leading-none">{label}</legend>
      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              {o.preview}
              <span className="text-sm font-medium">{o.title}</span>
              {o.hint ? <span className="text-xs text-muted-foreground">{o.hint}</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Miniature of a poster template: background, headline bar, photo block, text lines. */
function TemplateSwatch({ template, size }: { template: PosterInput["template"]; size: PosterInput["size"] }) {
  const blue = template === "blue";
  const bg = blue ? "bg-primary" : "bg-secondary";
  const ink = blue ? "bg-primary-foreground" : "bg-foreground";
  const head = blue ? "bg-primary-foreground" : "bg-destructive";
  return (
    <div className={`${bg} ${size === "story" ? "aspect-[9/16] w-10" : "aspect-square w-16"} flex flex-col gap-1 rounded-sm border p-1.5`} aria-hidden="true">
      <div className={`${head} h-2 w-2/3 rounded-sm`} />
      <div className={`${ink} h-0.5 w-1/4 opacity-60`} />
      <div className={`flex-1 rounded-sm border ${blue ? "border-primary-foreground/60" : "border-foreground/30"}`} />
      <div className={`${ink} h-0.5 w-full opacity-70`} />
      <div className={`${ink} h-0.5 w-3/4 opacity-70`} />
    </div>
  );
}

/** /poster — every saved poster plus the create button. */
export function PosterCatalogue({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = posterStrings[language];
  const auth = useGoogleAuth();
  const [items, setItems] = useState<MyMissing[] | null>(null);

  useEffect(() => {
    if (!auth.idToken) return;
    let cancelled = false;
    getDashboard(auth.idToken)
      .then((dash) => !cancelled && setItems([...dash.missing].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [auth.idToken]);

  const createButton = (
    <Button type="button" size="lg" onClick={() => navigate("posterNew")}>
      <Plus aria-hidden="true" />
      {t.newPoster}
    </Button>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.catalogueTitle} description={t.catalogueIntro} actions={createButton} />
      {!auth.idToken ? (
        auth.loading ? (
          <LoadingState label={t.loading} />
        ) : (
          <SignInNudge language={language} id="poster" title={t.catalogueSignedOutTitle} body={t.catalogueSignedOutBody} />
        )
      ) : items === null ? (
        <LoadingState label={t.loading} />
      ) : items.length === 0 ? (
        <EmptyState title={t.catalogueEmpty} description={t.catalogueEmptyBody} action={createButton} />
      ) : (
        <PosterGrid language={language} items={items} onChange={(fn) => setItems((list) => list && fn(list))} />
      )}
    </div>
  );
}

export function PosterPage({ language, navigate, savedId }: { language: Language; navigate: (page: Page) => void; savedId?: string }) {
  const t = posterStrings[language];
  const tl = labels[language];
  const auth = useGoogleAuth();
  const draft = useMemo(readDraft, []);
  const [input, setInput] = useState<PosterInput>(() => draft?.input ?? { ...EMPTY_POSTER, language });
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => draft?.photo ?? null);
  const [recordId, setRecordId] = useState<string>(() => savedId ?? crypto.randomUUID());
  const [photoRemote, setPhotoRemote] = useState<{ fileId: string; url: string } | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validatePoster>>({});
  const [assets, setAssets] = useState<PosterAssets>({ photo: null });
  const [downloaded, setDownloaded] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  const set = <K extends keyof PosterInput>(key: K, value: PosterInput[K]) => setInput((prev) => ({ ...prev, [key]: value }));

  // Draft persists across the sign-in redirect.
  useEffect(() => {
    writeDraft({ input, photo: photoUrl });
  }, [input, photoUrl]);

  useEffect(() => {
    if (!savedId || !auth.idToken) return;
    let cancelled = false;
    getDashboard(auth.idToken)
      .then((dash) => {
        const item = dash.missing.find((m) => m.id === savedId);
        if (!item || cancelled) return;
        const { photo, id, createdAt, updatedAt, ...fields } = item as MyMissing & MissingBody;
        setInput({ ...EMPTY_POSTER, ...fields, phones: [fields.phones[0] ?? "", fields.phones[1] ?? ""] });
        setRecordId(id);
        if (photo) {
          setPhotoRemote(photo);
          setPhotoUrl(photo.url);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [savedId, auth.idToken]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPosterFonts(), photoUrl ? loadImage(photoUrl).catch(() => null) : Promise.resolve(null)]).then(([, photo]) => {
      if (!cancelled) setAssets({ photo });
    });
    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  // Re-draw 250 ms after the last change.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (canvasRef.current) drawPoster(canvasRef.current, input, assets, posterStrings[input.language]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [input, assets, t]);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setPhotoError(true);
      return;
    }
    setPhotoError(false);
    setPhotoRemote(null);
    setSaveState("idle");
    setSaveMessage("");
    const resized = await downscaleImage(file, 1600);
    setPhotoUrl(await fileToDataUrl(resized));
  };

  const validate = () => {
    const next = validatePoster(input);
    setErrors(next);
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0];
      document.getElementById(`poster-${first}`)?.focus();
      return false;
    }
    return true;
  };

  const toBlob = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return Promise.resolve<Blob | null>(null);
    drawPoster(canvas, input, assets, posterStrings[input.language]);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  }, [assets, input, t]);

  const download = async () => {
    if (!validate()) return;
    const blob = await toBlob();
    if (!blob) {
      setExportError(true);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = posterFilename(input);
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  const share = async () => {
    if (!validate()) return;
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], posterFilename(input), { type: "image/png" });
    if (!navigator.canShare?.({ files: [file] })) return download();
    try {
      await navigator.share({ files: [file] });
      setDownloaded(true);
    } catch {
      // Sharing is cancelled by the user in the normal case.
    }
  };

  const save = async () => {
    if (!auth.idToken) return;
    if (!validate()) return;
    if (!photoUrl) {
      setSaveState("error");
      setSaveMessage(t.savePhotoRequired);
      return;
    }
    setSaveState("saving");
    setSaveMessage("");
    try {
      let photo = photoRemote;
      if (!photo && photoUrl.startsWith("data:")) {
        const blob = await (await fetch(photoUrl)).blob();
        const file = new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });
        photo = await uploadMedia((body) => presignMissingPhoto(auth.idToken as string, body), file);
        setPhotoRemote(photo);
      }
      await putMissing(auth.idToken, recordId, {
        ...input,
        phones: input.phones.map((p) => p.trim()).filter(Boolean),
        photo: photo ?? undefined,
      });
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setSaveMessage(apiErrorMessage(e, language) || t.saveError);
    }
  };

  const reset = () => {
    setInput({ ...EMPTY_POSTER, language });
    setPhotoUrl(null);
    setRecordId(crypto.randomUUID());
    setPhotoRemote(null);
    setErrors({});
    setDownloaded(false);
    setSaveState("idle");
    setSaveMessage("");
    setExportError(false);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Storage may be disabled.
    }
  };

  const errorCount = Object.keys(errors).length;
  const fieldError = (key: keyof PosterInput, message: string) =>
    errors[key] ? <p className="text-sm text-destructive">{message}</p> : null;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow={t.eyebrow}
        title={savedId ? t.editTitle : t.title}
        description={t.intro}
        actions={
          <Button asChild variant="outline">
            <a href="/poster">{t.backToCatalogue}</a>
          </Button>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-5 p-5 sm:p-6">
            {errorCount ? (
              <Alert variant="destructive">
                <AlertDescription>{t.validationSummary.replace("{n}", String(errorCount))}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="poster-photo">{t.photoLabel}</Label>
              <FileInput
                id="poster-photo"
                language={language}
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
              <p className="text-sm text-muted-foreground">{t.photoHint}</p>
              {photoError ? <p className="text-sm text-destructive">{t.photoError}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="poster-name">{t.nameLabel}</Label>
              <Input id="poster-name" value={input.name} maxLength={POSTER_LIMITS.name} onChange={(e) => set("name", e.target.value)} />
              {fieldError("name", t.validationName)}
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="poster-nickname">{t.nicknameLabel}</Label>
                <Input
                  id="poster-nickname"
                  value={input.nickname}
                  maxLength={POSTER_LIMITS.nickname}
                  onChange={(e) => set("nickname", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="poster-age">{t.ageLabel}</Label>
                <Input
                  type="number"
                  id="poster-age"
                  min={0}
                  max={120}
                  inputMode="numeric"
                  value={input.age}
                  onChange={(e) => set("age", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="poster-gender">{t.genderLabel}</Label>
                <NativeSelect
                  id="poster-gender"
                  value={input.gender}
                  onChange={(e) => set("gender", e.target.value as PosterInput["gender"])}
                >
                  <NativeSelectOption value="">{t.genderUnset}</NativeSelectOption>
                  <NativeSelectOption value="woman">{t.woman}</NativeSelectOption>
                  <NativeSelectOption value="man">{t.man}</NativeSelectOption>
                  <NativeSelectOption value="other">{t.other}</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="poster-district">{t.districtLabel}</Label>
                <NativeSelect id="poster-district" value={input.district} onChange={(e) => set("district", e.target.value)}>
                  <NativeSelectOption value="">{t.districtUnset}</NativeSelectOption>
                  {districtNames.map((d) => (
                    <NativeSelectOption key={d} value={d}>
                      {districtLabels[d][language]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {fieldError("district", t.validationDistrict)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="poster-place">{t.placeLabel}</Label>
                <Input
                  id="poster-place"
                  value={input.place}
                  maxLength={POSTER_LIMITS.place}
                  onChange={(e) => set("place", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">{t.placeHint}</p>
                {fieldError("place", t.validationPlace)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="poster-lastSeenAt">{t.lastSeenAtLabel}</Label>
              <Input
                id="poster-lastSeenAt"
                type="datetime-local"
                value={input.lastSeenAt}
                onChange={(e) => set("lastSeenAt", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poster-clothing">{t.clothingLabel}</Label>
              <Input
                id="poster-clothing"
                value={input.clothing}
                maxLength={POSTER_LIMITS.clothing}
                onChange={(e) => set("clothing", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poster-story">{t.storyLabel}</Label>
              <Textarea
                id="poster-story"
                rows={3}
                value={input.story}
                maxLength={POSTER_LIMITS.story}
                onChange={(e) => set("story", e.target.value)}
              />
              <p className="text-sm text-muted-foreground">{t.storyHint}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="poster-phones">{t.phoneLabel}</Label>
                <Input
                  id="poster-phones"
                  type="tel"
                  inputMode="tel"
                  value={input.phones[0]}
                  onChange={(e) => set("phones", [e.target.value, input.phones[1]])}
                />
                {fieldError("phones", t.validationPhones)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="poster-phone2">{t.phone2Label}</Label>
                <Input
                  id="poster-phone2"
                  type="tel"
                  inputMode="tel"
                  value={input.phones[1]}
                  onChange={(e) => set("phones", [input.phones[0], e.target.value])}
                />
              </div>
            </div>
            <p className="text-sm text-destructive">{t.phoneWarning}</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="poster-status">{t.statusLabel}</Label>
                <NativeSelect
                  id="poster-status"
                  value={input.status}
                  onChange={(e) => set("status", e.target.value as PosterInput["status"])}
                >
                  <NativeSelectOption value="missing">{t.statusMissing}</NativeSelectOption>
                  <NativeSelectOption value="found">{t.statusFound}</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="poster-language">{t.languageLabel}</Label>
                <NativeSelect id="poster-language" value={input.language} onChange={(e) => set("language", e.target.value as Language)}>
                  <NativeSelectOption value="en">English</NativeSelectOption>
                  <NativeSelectOption value="ne">नेपाली</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>
            <TileRadio
              label={t.templateLabel}
              value={input.template}
              onChange={(v) => set("template", v)}
              options={[
                { value: "paper", title: t.templatePaper, preview: <TemplateSwatch template="paper" size={input.size} /> },
                { value: "blue", title: t.templateBlue, preview: <TemplateSwatch template="blue" size={input.size} /> },
              ]}
            />
            <TileRadio
              label={t.sizeLabel}
              value={input.size}
              onChange={(v) => set("size", v)}
              options={[
                {
                  value: "feed",
                  title: t.sizeFeedTitle,
                  hint: t.sizeFeedApps,
                  preview: <div className="aspect-square w-12 rounded-sm border-2 border-current opacity-70" aria-hidden="true" />,
                },
                {
                  value: "story",
                  title: t.sizeStoryTitle,
                  hint: t.sizeStoryApps,
                  preview: <div className="aspect-[9/16] w-7 rounded-sm border-2 border-current opacity-70" aria-hidden="true" />,
                },
              ]}
            />
          </CardContent>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-subtle">{t.previewLabel}</p>
          <canvas
            ref={canvasRef}
            className={`w-full rounded-xl border ${input.size === "story" ? "max-w-sm" : ""}`}
            aria-label={t.previewLabel}
            role="img"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" size="lg" className="flex-1" onClick={download}>
              <Download aria-hidden="true" />
              {t.download}
            </Button>
            {canShare ? (
              <Button type="button" size="lg" variant="secondary" className="flex-1" onClick={share}>
                <Share2 aria-hidden="true" />
                {t.share}
              </Button>
            ) : null}
          </div>
          {exportError ? (
            <Alert variant="destructive">
              <AlertDescription>{t.exportError}</AlertDescription>
            </Alert>
          ) : null}
          {downloaded ? (
            <>
              <p role="status" className="text-sm font-medium text-success">
                {t.downloaded}
              </p>
              {!auth.idToken ? <SignInNudge language={language} id="poster" title={t.nudgeTitle} body={t.nudgeBody} /> : null}
              <Button type="button" variant="link" className="px-0" onClick={reset}>
                {t.reset}
              </Button>
            </>
          ) : null}
          {auth.idToken ? (
            <>
              <Button type="button" variant="secondary" disabled={saveState === "saving"} onClick={save}>
                {saveState === "saving" ? t.saving : t.save}
              </Button>
              {saveState === "saved" ? (
                <p role="status" className="text-sm font-medium text-success">
                  {t.saved}
                </p>
              ) : null}
              {saveState === "error" ? (
                <p role="alert" className="text-sm text-destructive">
                  {saveMessage}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{tl.absenceNote}</p>
    </div>
  );
}
