import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { posterStrings } from "@/i18n/poster";
import { labels } from "@/i18n";
import { districtLabels, districtNames } from "@/lib/geo";
import { downscaleImage } from "@/lib/image";
import { EMPTY_POSTER, POSTER_LIMITS, posterFilename, validatePoster, type PosterInput } from "@/lib/poster";
import { drawPoster, loadLogo, loadPosterFonts, type PosterAssets } from "@/lib/poster-draw";
import type { Language, Page } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

export function PosterPage({ language }: { language: Language; navigate: (page: Page) => void }) {
  const t = posterStrings[language];
  const tl = labels[language];
  const draft = useMemo(readDraft, []);
  const [input, setInput] = useState<PosterInput>(() => draft?.input ?? { ...EMPTY_POSTER, language });
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => draft?.photo ?? null);
  const [photoError, setPhotoError] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validatePoster>>({});
  const [assets, setAssets] = useState<PosterAssets>({ photo: null, logo: null });
  const [downloaded, setDownloaded] = useState(false);
  const [exportError, setExportError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  const set = <K extends keyof PosterInput>(key: K, value: PosterInput[K]) => setInput((prev) => ({ ...prev, [key]: value }));

  // Draft persists across the sign-in redirect.
  useEffect(() => {
    writeDraft({ input, photo: photoUrl });
  }, [input, photoUrl]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPosterFonts(), loadLogo(), photoUrl ? loadImage(photoUrl).catch(() => null) : Promise.resolve(null)]).then(
      ([, logo, photo]) => {
        if (!cancelled) setAssets({ logo, photo });
      },
    );
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

  const reset = () => {
    setInput({ ...EMPTY_POSTER, language });
    setPhotoUrl(null);
    setErrors({});
    setDownloaded(false);
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
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.intro} />
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
              <Input
                id="poster-photo"
                type="file"
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
              <div className="space-y-2">
                <Label htmlFor="poster-template">{t.templateLabel}</Label>
                <NativeSelect
                  id="poster-template"
                  value={input.template}
                  onChange={(e) => set("template", e.target.value as PosterInput["template"])}
                >
                  <NativeSelectOption value="paper">{t.templatePaper}</NativeSelectOption>
                  <NativeSelectOption value="blue">{t.templateBlue}</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="poster-size">{t.sizeLabel}</Label>
                <NativeSelect id="poster-size" value={input.size} onChange={(e) => set("size", e.target.value as PosterInput["size"])}>
                  <NativeSelectOption value="feed">{t.sizeFeed}</NativeSelectOption>
                  <NativeSelectOption value="story">{t.sizeStory}</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>
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
              <SignInNudge language={language} id="poster" title={t.nudgeTitle} body={t.nudgeBody} />
              <Button type="button" variant="link" className="px-0" onClick={reset}>
                {t.reset}
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{tl.absenceNote}</p>
    </div>
  );
}
