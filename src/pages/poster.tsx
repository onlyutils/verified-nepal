import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Download, ExternalLink, Phone, Plus, Search, Share2 } from "lucide-react";
import { posterStrings } from "@/i18n/poster";
import { labels } from "@/i18n";
import { districtLabels, districtNames } from "@/lib/geo";
import { downscaleImage } from "@/lib/image";
import { apiErrorMessage } from "@/lib/api-error";
import {
  getDashboard,
  getMissing,
  presignMissingPhoto,
  putMissing,
  type MissingBody,
  type MissingListResponse,
  type MyMissing,
} from "@/lib/api";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { useGoogleAuth } from "@/lib/auth";
import { uploadMedia } from "@/lib/media";
import {
  EMPTY_POSTER,
  lastSeenLine,
  posterFilename,
  posterHeadline,
  posterNameLine,
  POSTER_LIMITS,
  POSTER_SIZES,
  validatePoster,
  type PosterInput,
  type PosterStatus,
} from "@/lib/poster";
import { drawPoster, loadPosterFonts, type PosterAssets } from "@/lib/poster-draw";
import type { Language, Page } from "@/lib/types";
import { opmcmMissingPersonUrl } from "@/lib/urls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { SignInNudge } from "@/components/sign-in-nudge";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, type StatusTone } from "@/components/status-badge";

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

/** A saved record, read back as the poster form shape the drawing code and card text expect. */
function toPosterInput(item: MyMissing, language: Language): PosterInput {
  const phones = Array.isArray(item.phones) ? (item.phones as string[]) : [];
  return {
    ...EMPTY_POSTER,
    ...(item as unknown as PosterInput),
    language,
    phones: [phones[0] ?? "", phones[1] ?? ""],
  };
}

const POSTER_TONE: Record<PosterStatus, StatusTone> = { missing: "danger", found: "info", safe: "success" };

async function renderPosterBlob(item: MyMissing, language: Language): Promise<{ blob: Blob; filename: string } | null> {
  const input = toPosterInput(item, language);
  const t = posterStrings[input.language];
  await loadPosterFonts();
  const photo = item.photo ? await loadImage(item.photo.url).catch(() => null) : null;
  const canvas = document.createElement("canvas");
  drawPoster(canvas, input, { photo }, t);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob ? { blob, filename: posterFilename(input) } : null;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** One-tap share of the rendered poster picture, falling back to a download. */
async function sharePosterImage(item: MyMissing, language: Language) {
  const rendered = await renderPosterBlob(item, language);
  if (!rendered) return;
  const file = new File([rendered.blob], rendered.filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      return;
    }
  }
  downloadBlob(rendered.blob, rendered.filename);
}

/** Status as a row of pills; the active pill fills with that status's own colour. */
const STATUS_ACTIVE_CLASS: Record<PosterStatus, string> = {
  missing: "border-destructive bg-destructive text-destructive-foreground",
  found: "border-primary bg-primary text-primary-foreground",
  safe: "border-success bg-success text-success-foreground",
};

function StatusPicker({
  value,
  onChange,
  t,
}: {
  value: PosterStatus;
  onChange: (v: PosterStatus) => void;
  t: (typeof posterStrings)["en"];
}) {
  const options: { value: PosterStatus; label: string }[] = [
    { value: "missing", label: t.statusMissing },
    { value: "found", label: t.statusFound },
    { value: "safe", label: t.statusSafe },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.statusLabel}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-10 items-center rounded-full border-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? STATUS_ACTIVE_CLASS[o.value] : "border-input bg-background text-foreground hover:bg-accent"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function LanguagePicker({ value, onChange }: { value: Language; onChange: (v: Language) => void }) {
  const options: { value: Language; label: string }[] = [
    { value: "en", label: "English" },
    { value: "ne", label: "नेपाली" },
  ];
  return (
    <div className="inline-flex rounded-full border p-1" role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`h-8 rounded-full px-4 text-sm font-medium transition-colors ${
              active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A tile previewing the poster's colour scheme, with a checkmark badge when selected. */
function TemplatePicker({
  value,
  onChange,
  t,
}: {
  value: PosterInput["template"];
  onChange: (v: PosterInput["template"]) => void;
  t: (typeof posterStrings)["en"];
}) {
  const options: { value: PosterInput["template"]; label: string; hint: string }[] = [
    { value: "paper", label: t.templatePaper, hint: t.templatePaperHint },
    { value: "blue", label: t.templateBlue, hint: t.templateBlueHint },
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium leading-none">{t.templateLabel}</legend>
      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => {
          const active = o.value === value;
          const blue = o.value === "blue";
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`relative rounded-lg border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div
                className={`flex aspect-[2/1] w-full flex-col gap-1.5 overflow-hidden rounded-md p-2 ${blue ? "bg-primary" : "bg-secondary"}`}
                aria-hidden="true"
              >
                <div className={`h-2.5 w-3/4 rounded-sm ${blue ? "bg-primary-foreground" : "bg-destructive"}`} />
                <div className={`h-1.5 w-1/2 rounded-sm ${blue ? "bg-primary-foreground/80" : "bg-destructive/70"}`} />
                <div className="mt-auto space-y-1">
                  <div className={`h-1 w-full rounded-sm ${blue ? "bg-primary-foreground/50" : "bg-muted-foreground/40"}`} />
                  <div className={`h-1 w-2/3 rounded-sm ${blue ? "bg-primary-foreground/50" : "bg-muted-foreground/40"}`} />
                </div>
              </div>
              <p className="mt-2 text-sm font-semibold">{o.label}</p>
              <p className="text-xs text-muted-foreground">{o.hint}</p>
              <span
                aria-hidden="true"
                className={`absolute bottom-3 right-3 flex size-5 items-center justify-center rounded-full border-2 ${
                  active ? "border-primary bg-primary text-primary-foreground" : "border-input"
                }`}
              >
                {active ? <Check className="size-3" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A row tile: outline icon on the left, title + platform hint on the right. */
function SizePicker({
  value,
  onChange,
  t,
}: {
  value: PosterInput["size"];
  onChange: (v: PosterInput["size"]) => void;
  t: (typeof posterStrings)["en"];
}) {
  const options: { value: PosterInput["size"]; label: string; hint: string; icon: ReactNode }[] = [
    {
      value: "feed",
      label: t.sizeFeedTitle,
      hint: t.sizeFeedApps,
      icon: <span className="block size-6 shrink-0 rounded-[3px] border-2 border-current" aria-hidden="true" />,
    },
    {
      value: "story",
      label: t.sizeStoryTitle,
      hint: t.sizeStoryApps,
      icon: <span className="block h-7 w-4 shrink-0 rounded-[4px] border-2 border-current" aria-hidden="true" />,
    },
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium leading-none">{t.sizeLabel}</legend>
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
              className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              {o.icon}
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A numbered card: "01 Status", "02 Photo" … matching the Figma section layout. */
function SectionCard({ number, title, hint, children }: { number: string; title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold text-subtle">{number}</p>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** Board card: summary text plus Open (view the poster picture) and Share (send it directly). */
function PosterBoardCard({ item, language, onOpen }: { item: MyMissing; language: Language; onOpen: () => void }) {
  const t = posterStrings[language];
  const input = toPosterInput(item, language);
  const phone = input.phones.find((p) => p.trim());

  return (
    <Card>
      <CardContent className="flex gap-4 p-4">
        {item.photo ? (
          <img src={item.photo.url} alt="" className="h-20 w-20 shrink-0 rounded-md object-cover" loading="lazy" />
        ) : (
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] text-muted-foreground"
            aria-hidden="true"
          >
            photo
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{posterNameLine(input)}</span>
            <StatusBadge tone={POSTER_TONE[input.status]}>{posterHeadline(input.status, t)}</StatusBadge>
          </div>
          <p className="text-muted-foreground">{lastSeenLine(input, t)}</p>
          {input.story.trim() ? <p className="truncate text-muted-foreground">{input.story.trim()}</p> : null}
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            {phone ? (
              <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline">
                <Phone aria-hidden="true" className="size-3.5" />
                {phone}
              </a>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-full px-3" onClick={onOpen}>
                {t.cardOpen}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-full px-3"
                onClick={() => sharePosterImage(item, language)}
              >
                {t.cardShare}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Renders the actual poster picture for a saved record, with download/share — reuses the same drawing code as the creator. */
function PosterViewDialog({
  item,
  language,
  onOpenChange,
}: {
  item: MyMissing | null;
  language: Language;
  onOpenChange: (open: boolean) => void;
}) {
  const t = posterStrings[language];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<PosterAssets>({ photo: null });
  const input = useMemo(() => (item ? toPosterInput(item, language) : null), [item, language]);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    Promise.all([loadPosterFonts(), item.photo ? loadImage(item.photo.url).catch(() => null) : Promise.resolve(null)]).then(([, photo]) => {
      if (!cancelled) setAssets({ photo });
    });
    return () => {
      cancelled = true;
    };
  }, [item]);

  useEffect(() => {
    if (!input || !canvasRef.current) return;
    drawPoster(canvasRef.current, input, assets, posterStrings[input.language]);
  }, [input, assets]);

  const canShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {item && input ? (
          <>
            <DialogHeader>
              <DialogTitle>{posterNameLine(input)}</DialogTitle>
            </DialogHeader>
            <canvas
              ref={canvasRef}
              className={`w-full rounded-lg border ${input.size === "story" ? "max-w-xs" : ""}`}
              aria-label={t.previewLabel}
              role="img"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                onClick={() => renderPosterBlob(item, language).then((r) => r && downloadBlob(r.blob, r.filename))}
              >
                <Download aria-hidden="true" />
                {t.download}
              </Button>
              {canShare ? (
                <Button type="button" variant="secondary" className="flex-1" onClick={() => sharePosterImage(item, language)}>
                  <Share2 aria-hidden="true" />
                  {t.cardShare}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** /poster — public board of every saved poster, missing first, plus the create button. */
export function PosterCatalogue({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = posterStrings[language];
  const [data, setData] = useState<MissingListResponse | null | "error">(null);
  const [filter, setFilter] = useState<"all" | PosterStatus>("all");
  const [query, setQuery] = useState("");
  const [openItem, setOpenItem] = useState<MyMissing | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMissing()
      .then((res) => !cancelled && setData(res))
      .catch(() => !cancelled && setData("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  const createButton = (
    <Button type="button" size="lg" onClick={() => navigate("posterNew")}>
      <Plus aria-hidden="true" />
      {t.newPoster}
    </Button>
  );

  const items = data && data !== "error" ? data.items : [];
  const missingDistricts = useMemo(
    () => new Set(items.filter((m) => m.status === "missing" && m.district).map((m) => m.district)).size,
    [items],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((m) => {
      if (filter !== "all" && m.status !== filter) return false;
      if (!q) return true;
      const phones = Array.isArray(m.phones) ? (m.phones as string[]) : [];
      return [m.name, m.district, ...phones].join(" ").toLowerCase().includes(q);
    });
  }, [items, filter, query]);

  const filterOptions: { value: "all" | PosterStatus; label: string }[] = [
    { value: "all", label: t.filterAll },
    { value: "missing", label: t.filterMissing },
    { value: "found", label: t.filterFound },
    { value: "safe", label: t.filterSafe },
  ];
  const filtering = filter !== "all" || query.trim().length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.catalogueTitle} description={t.catalogueIntro} actions={createButton} />
      <aside className="border-l-2 border-primary pl-4 text-sm leading-relaxed text-muted-foreground">
        <p className="font-semibold text-primary">{t.disclaimerTitle}</p>
        <p className="mt-1">{t.disclaimerBody}</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <a href={opmcmMissingPersonUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            {t.disclaimerLink}
          </a>
        </Button>
      </aside>
      {data === null ? (
        <LoadingState label={t.loading} />
      ) : data === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{t.catalogueError}</AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <EmptyState title={t.catalogueEmpty} description={t.catalogueEmptyBody} action={createButton} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              value={data.counts.missing}
              label={t.kpiMissing}
              hint={t.kpiMissingHint.replace("{n}", String(missingDistricts))}
              tone="danger"
            />
            <StatCard value={data.counts.found} label={t.kpiFound} hint={t.kpiFoundHint} tone="primary" />
            <StatCard value={data.counts.safe} label={t.kpiSafe} hint={t.kpiSafeHint} tone="success" />
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.filterAll}>
                {filterOptions.map((o) => {
                  const active = o.value === filter;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setFilter(o.value)}
                      className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        active ? "border-foreground bg-foreground text-background" : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <div className="relative w-full sm:w-72">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="pl-9" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {filtering
                ? t.showingFiltered.replace("{n}", String(filtered.length)).replace("{m}", String(items.length))
                : t.showingAll.replace("{n}", String(items.length))}
            </p>
            {filtered.length === 0 ? (
              <EmptyState icon={Search} title={t.noResultsTitle} description={t.noResultsBody} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((m) => (
                  <PosterBoardCard key={m.id} item={m} language={language} onOpen={() => setOpenItem(m)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <PosterViewDialog item={openItem} language={language} onOpenChange={(open) => !open && setOpenItem(null)} />
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
    downloadBlob(blob, posterFilename(input));
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
  const size = POSTER_SIZES[input.size];

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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {errorCount ? (
            <Alert variant="destructive">
              <AlertDescription>{t.validationSummary.replace("{n}", String(errorCount))}</AlertDescription>
            </Alert>
          ) : null}

          <SectionCard number="01" title={t.sectionStatus} hint={t.statusHint}>
            <StatusPicker value={input.status} onChange={(v) => set("status", v)} t={t} />
          </SectionCard>

          <SectionCard number="02" title={t.sectionPhoto}>
            <FileInput
              id="poster-photo"
              language={language}
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onPhoto(e.target.files?.[0])}
            />
            <p className="text-sm text-muted-foreground">{t.photoHint}</p>
            {photoError ? <p className="text-sm text-destructive">{t.photoError}</p> : null}
          </SectionCard>

          <SectionCard number="03" title={t.sectionPerson}>
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
                  <NativeSelectOption value="girl">{t.girl}</NativeSelectOption>
                  <NativeSelectOption value="boy">{t.boy}</NativeSelectOption>
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
              <div className="flex items-baseline justify-between">
                <Label htmlFor="poster-story">{t.storyLabel}</Label>
                <span className="text-xs text-subtle">
                  {input.story.length}/{POSTER_LIMITS.story}
                </span>
              </div>
              <Textarea
                id="poster-story"
                rows={3}
                value={input.story}
                maxLength={POSTER_LIMITS.story}
                onChange={(e) => set("story", e.target.value)}
              />
              <p className="text-sm text-muted-foreground">{t.storyHint}</p>
            </div>
          </SectionCard>

          <SectionCard number="04" title={t.sectionContact}>
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
            <p className="border-l-2 border-destructive pl-3 text-sm text-destructive">{t.phoneWarning}</p>
          </SectionCard>

          <SectionCard number="05" title={t.sectionPoster}>
            <div className="space-y-2">
              <Label>{t.languageLabel}</Label>
              <LanguagePicker value={input.language} onChange={(v) => set("language", v)} />
            </div>
            <TemplatePicker value={input.template} onChange={(v) => set("template", v)} t={t} />
            <SizePicker value={input.size} onChange={(v) => set("size", v)} t={t} />
          </SectionCard>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-subtle">{t.previewLabel}</p>
            <p className="text-xs text-subtle">{t.dimensions.replace("{w}", String(size.width)).replace("{h}", String(size.height))}</p>
          </div>
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
