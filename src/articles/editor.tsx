import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { articlesEditorStrings } from "@/i18n/articles-editor";
import { localStrings } from "@/i18n/local";
import { MunicipalitySelect } from "@/components/municipality-select";
import { districtLabels, districtNames } from "@/lib/districts";
import { municipalityById } from "@/lib/admin-units";
import { formatBsDate, formatRelativeTime, formatNumber } from "@/lib/format-date";
import { communityStrings } from "@/i18n/community";
import {
  ApiError,
  createArticle,
  DISPATCH_TAGS,
  getMyArticle,
  listMyArticles,
  presignArticleMedia,
  saveArticle,
  submitArticle,
  type ArticleSaveBody,
  type ArticleStatus,
  type DispatchTag,
  type MyArticleDetail,
} from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { useGoogleAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { MediaUploadError, uploadMedia } from "@/lib/media";
import type { Language } from "@/lib/types";
import { BLOCK_LIMITS, MEDIA_LIMITS } from "./types";
import type { Block, Cover, MediaBlock, TextBlock } from "./types";
import { trimBlocks, trimCover, validateArticle, type ArticleMissingCode } from "./validate";
import { ArticleBody } from "./render";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader } from "@/components/page-header";
import { SignInNudge } from "@/components/sign-in-nudge";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/empty-state";

function uid() {
  return crypto.randomUUID();
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  id,
  maxLength,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  id: string;
  maxLength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, []);
  useEffect(resize, [resize, value]);
  return (
    <Textarea
      ref={ref}
      id={id}
      rows={1}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      className={`min-h-16 resize-none border-0 px-0 py-2 text-base leading-8 shadow-none focus-visible:ring-0 ${className}`}
      onInput={resize}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function loadedBlocks(blocks: Block[] | undefined) {
  return (blocks ?? []).map((block) => ({ ...block, id: block.id ?? uid() }));
}

function makeBlock(type: "paragraph" | "heading" | "quote" | "image" | "video"): Block {
  if (type === "image" || type === "video") return { id: uid(), type, url: "", fileId: "", source: "" };
  return { id: uid(), type, text: "" };
}

function tagLabel(tag: DispatchTag, language: Language) {
  const t = communityStrings[language];
  return {
    climate: t.tagClimate,
    mountains: t.tagMountains,
    floods: t.tagFloods,
    landslides: t.tagLandslides,
    glaciers: t.tagGlaciers,
    community: t.tagCommunity,
    story: t.tagStory,
  }[tag];
}

function missingLabel(code: ArticleMissingCode, t: (typeof articlesEditorStrings)["en"]) {
  if (code === "title") return t.missingTitle;
  if (code === "cover") return t.missingCover;
  if (code === "cover.source") return t.missingCoverSource;
  if (code === "paragraph") return t.missingParagraph;
  if (code === "tags") return t.missingTags;
  return t.missingBlockSource.replace("{index}", String(Number(code.split(":")[1]) + 1));
}

function statusLabel(status: ArticleStatus, t: (typeof articlesEditorStrings)["en"]) {
  return { draft: t.statusDraft, pending: t.statusPending, published: t.statusPublished, rejected: t.statusRejected }[status];
}

export function ArticleEditor({ language, id }: { language: Language; id: string }) {
  const localUpdate = new URLSearchParams(window.location.search).get("kind") === "news";
  return localUpdate ? <LocalUpdateEditor key={id} language={language} id={id} /> : <StandardArticleEditor key={id} language={language} id={id} />;
}

function StandardArticleEditor({ language, id }: { language: Language; id: string }) {
  const t = articlesEditorStrings[language];
  const auth = useGoogleAuth();
  const [article, setArticle] = useState<MyArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [submitMissing, setSubmitMissing] = useState<ArticleMissingCode[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [blockMenu, setBlockMenu] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, boolean>>({});
  const [uploadUnavailable, setUploadUnavailable] = useState<Record<string, boolean>>({});
  const files = useRef(new Map<string, File>());
  const revision = useRef(0);

  const load = useCallback(async () => {
    if (!auth.idToken) return;
    setLoading(true);
    setError(null);
    try {
      const next = await getMyArticle(auth.idToken, id);
      setArticle({ ...next, blocks: loadedBlocks(next.blocks) });
      setDirty(false);
      setSaveState("saved");
      setLastSaved(next.updatedAt);
      setSubmitMissing([]);
    } catch (cause) {
      setError(apiErrorMessage(cause, language) || t.loadError);
    } finally {
      setLoading(false);
    }
  }, [auth.idToken, id, language, t.loadError]);

  useEffect(() => {
    if (auth.idToken) void load();
  }, [auth.idToken, load]);

  const update = useCallback((patch: Partial<MyArticleDetail>) => {
    revision.current += 1;
    setArticle((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
    setSaveState("idle");
    setSubmitMissing([]);
  }, []);

  const saveBody = useMemo<ArticleSaveBody | null>(() => {
    if (!article) return null;
    return {
      title: article.title,
      blocks: trimBlocks(article.blocks),
      cover: trimCover(article.cover),
      tags: article.tags,
      language: article.language,
      displayName: article.displayName,
      place: article.place,
    };
  }, [article]);

  useEffect(() => {
    if (!dirty || !auth.idToken || !article || article.status === "pending" || article.status === "published" || !saveBody) return;
    let cancelled = false;
    const snapshot = saveBody;
    const snapshotRevision = revision.current;
    let timer: number | undefined;
    let retryDelay = 4000;
    const attempt = (delay: number) => {
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        setSaveState("saving");
        try {
          const result = await saveArticle(auth.idToken as string, id, snapshot);
          if (cancelled) return;
          setLastSaved(result.updatedAt);
          setSaveState("saved");
          if (revision.current === snapshotRevision) setDirty(false);
        } catch (cause) {
          if (cancelled) return;
          if (cause instanceof ApiError && cause.status === 409) {
            await load();
            setError(t.conflict);
            return;
          }
          setSaveState("error");
          attempt(retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30000);
        }
      }, delay);
    };
    attempt(2000);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [article, auth.idToken, dirty, id, load, saveBody, t.conflict]);

  const startUpload = useCallback(
    async (file: File, kind: "image" | "video", blockId?: string) => {
      if (!auth.idToken) return;
      const put = (result: { fileId: string; url: string }) => {
        if (blockId) {
          update({
            blocks: (article?.blocks ?? []).map((block) =>
              block.id === blockId ? ({ ...block, type: kind, ...result } as MediaBlock) : block,
            ),
          });
          setUploadErrors((current) => ({ ...current, [blockId]: false }));
        } else {
          update({ cover: { ...result, source: "" } });
        }
      };
      const key = blockId ?? "cover";
      try {
        files.current.set(key, file);
        setUploadErrors((current) => ({ ...current, [key]: false }));
        setUploadUnavailable((current) => ({ ...current, [key]: false }));
        await uploadMedia(
          (body) => presignArticleMedia(auth.idToken as string, body),
          file,
          (fraction) => {
            setUploadProgress((current) => ({ ...current, [key]: fraction }));
          },
        ).then(put);
      } catch (cause) {
        setUploadErrors((current) => ({ ...current, [key]: true }));
        setUploadUnavailable((current) => ({
          ...current,
          [key]:
            cause instanceof MediaUploadError && cause.code === "presign" && cause.cause instanceof ApiError && cause.cause.status === 503,
        }));
      }
    },
    [article?.blocks, auth.idToken, update],
  );

  const addBlock = (after: number, type: "paragraph" | "heading" | "quote" | "image" | "video") => {
    if (!article || article.blocks.length >= BLOCK_LIMITS.maxBlocks) return;
    const next = [...article.blocks];
    next.splice(after, 0, makeBlock(type));
    update({ blocks: next });
    setBlockMenu(null);
  };

  const updateBlock = (index: number, patch: Partial<Block>) => {
    if (!article) return;
    update({ blocks: article.blocks.map((block, current) => (current === index ? ({ ...block, ...patch } as Block) : block)) });
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    if (!article) return;
    const target = index + direction;
    if (target < 0 || target >= article.blocks.length) return;
    const next = [...article.blocks];
    [next[index], next[target]] = [next[target], next[index]];
    update({ blocks: next });
  };

  const submit = async () => {
    if (!article || !auth.idToken || saveState !== "saved" || dirty) return;
    const missing = validateArticle(article);
    setSubmitMissing(missing);
    if (missing.length) return;
    setSubmitting(true);
    try {
      const result = await submitArticle(auth.idToken, id);
      setArticle((current) => (current ? { ...current, status: result.status as ArticleStatus } : current));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) await load();
      else setError(apiErrorMessage(cause, language));
    } finally {
      setSubmitting(false);
    }
  };

  if (auth.loading || (loading && !article)) return <LoadingState label={t.loading} />;
  if (!auth.idToken) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader eyebrow={t.eyebrow} title={t.title} />
        <SignInNudge language={language} id={`article-${id}`} title={t.signedOutTitle} body={t.signedOutBody} />
      </div>
    );
  }
  if (error && !article)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error}{" "}
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            {t.retry}
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!article) return null;
  const readOnly = article.status === "pending" || article.status === "published";
  const sourceInputClass = (value: string) => (!value.trim() ? "border-destructive focus-visible:ring-destructive" : "");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader eyebrow={t.eyebrow} title={article.title || t.title} description={readOnly ? t.readOnly : undefined} />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {readOnly || preview ? (
        <Card>
          <CardContent className="p-6 sm:p-10">
            {article.cover?.url ? (
              <figure className="mb-10">
                <img src={article.cover.url} alt={article.cover.caption || ""} className="w-full rounded-xl object-cover" />
                <figcaption className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {article.cover.caption ? <span className="block">{article.cover.caption}</span> : null}
                  <span className="block">
                    {t.articleSource}: {article.cover.source}
                  </span>
                </figcaption>
              </figure>
            ) : null}
            <ArticleBody blocks={article.blocks} language={language} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="space-y-8">
            <div className="space-y-2">
              <Label htmlFor="article-title" className="sr-only">
                {t.titleLabel}
              </Label>
              <Input
                id="article-title"
                value={article.title}
                maxLength={BLOCK_LIMITS.maxTitle}
                placeholder={t.titlePlaceholder}
                onChange={(event) => update({ title: event.target.value })}
                className="h-auto border-0 px-0 py-2 text-3xl font-bold shadow-none focus-visible:ring-0 sm:text-5xl"
              />
            </div>
            <div className="space-y-3 rounded-xl border border-dashed p-5">
              <p className="font-semibold">{t.cover}</p>
              <label
                htmlFor="article-cover-file"
                className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg bg-muted/40 p-6 text-center transition-colors hover:bg-accent focus-within:ring-2 focus-within:ring-ring"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files[0];
                  if (file) void startUpload(file, "image");
                }}
              >
                {article.cover?.url ? (
                  <img src={article.cover.url} alt={article.cover.caption || ""} className="max-h-64 w-full rounded-lg object-cover" />
                ) : (
                  <>
                    <ImagePlus aria-hidden="true" className="mb-2 size-8 text-muted-foreground" />
                    <span>{t.coverDrop}</span>
                    <span className="mt-1 text-sm text-muted-foreground">{t.chooseFile}</span>
                  </>
                )}
                <input
                  id="article-cover-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void startUpload(file, "image");
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {uploadProgress.cover !== undefined && uploadProgress.cover < 1 ? (
                <progress className="h-2 w-full" max={1} value={uploadProgress.cover} aria-label={t.cover} />
              ) : null}
              {uploadErrors.cover ? (
                <p role="alert" className="text-sm text-destructive">
                  {uploadUnavailable.cover ? t.uploadUnavailable : t.uploadFailed}{" "}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => {
                      const file = files.current.get("cover");
                      if (file) void startUpload(file, "image");
                    }}
                  >
                    {t.retryUpload}
                  </Button>
                </p>
              ) : null}
              {article.cover ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="cover-source">{t.coverSource}</Label>
                    <Input
                      id="cover-source"
                      value={article.cover.source}
                      maxLength={BLOCK_LIMITS.maxSource}
                      className={sourceInputClass(article.cover.source)}
                      onChange={(event) => update({ cover: { ...(article.cover as Cover), source: event.target.value } })}
                    />
                    {!article.cover.source.trim() ? <p className="mt-1 text-sm text-destructive">{t.sourceRequired}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="cover-caption">{t.coverCaption}</Label>
                    <Input
                      id="cover-caption"
                      value={article.cover.caption ?? ""}
                      maxLength={BLOCK_LIMITS.maxCaption}
                      onChange={(event) => update({ cover: { ...(article.cover as Cover), caption: event.target.value } })}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-3">
              {article.blocks.map((block, index) => (
                <div key={block.id ?? index}>
                  <EditorBlock
                    block={block}
                    index={index}
                    total={article.blocks.length}
                    t={t}
                    progress={uploadProgress[block.id ?? ""]}
                    uploadError={uploadErrors[block.id ?? ""]}
                    uploadUnavailable={uploadUnavailable[block.id ?? ""]}
                    onChange={(patch) => updateBlock(index, patch)}
                    onMove={moveBlock}
                    onDelete={() => update({ blocks: article.blocks.filter((_, current) => current !== index) })}
                    onUpload={(file) => void startUpload(file, block.type === "video" ? "video" : "image", block.id)}
                    onRetry={() => {
                      const file = files.current.get(block.id ?? "");
                      if (file) void startUpload(file, block.type === "video" ? "video" : "image", block.id);
                    }}
                  />
                  <BlockInsert
                    t={t}
                    open={blockMenu === index + 1}
                    onToggle={() => setBlockMenu(blockMenu === index + 1 ? null : index + 1)}
                    onSelect={(type) => addBlock(index + 1, type)}
                  />
                </div>
              ))}
              {!article.blocks.length ? (
                <BlockInsert
                  t={t}
                  open={blockMenu === 0}
                  onToggle={() => setBlockMenu(blockMenu === 0 ? null : 0)}
                  onSelect={(type) => addBlock(0, type)}
                />
              ) : null}
            </div>
          </section>
          <aside className="space-y-4 lg:sticky lg:top-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t.status}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <StatusBadge tone={toneForStatus(article.status)}>{statusLabel(article.status, t)}</StatusBadge>
                <p role="status" className="text-sm text-muted-foreground">
                  {saveState === "saving"
                    ? t.saving
                    : saveState === "error"
                      ? t.notSaved
                      : saveState === "saved"
                        ? `${t.saved}${lastSaved ? ` · ${t.lastSaved}: ${formatDateTime(lastSaved, language)}` : ""}`
                        : t.saving}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t.displayName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="article-display-name">{t.displayName}</Label>
                  <Input
                    id="article-display-name"
                    value={article.displayName}
                    placeholder={t.displayNamePlaceholder}
                    onChange={(event) => update({ displayName: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="article-place">{t.place}</Label>
                  <Input id="article-place" value={article.place ?? ""} onChange={(event) => update({ place: event.target.value })} />
                </div>
                <div>
                  <Label htmlFor="article-language">{t.language}</Label>
                  <NativeSelect
                    id="article-language"
                    value={article.language}
                    onChange={(event) => update({ language: event.target.value as Language })}
                  >
                    <NativeSelectOption value="en">{t.english}</NativeSelectOption>
                    <NativeSelectOption value="ne">{t.nepali}</NativeSelectOption>
                  </NativeSelect>
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">{t.tags}</legend>
                  <p className="mb-2 text-xs text-muted-foreground">{t.tagsHint}</p>
                  <div className="flex flex-wrap gap-2">
                    {DISPATCH_TAGS.map((tag) => {
                      const selected = article.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          aria-pressed={selected}
                          className={`min-h-10 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                          onClick={() => {
                            if (selected) update({ tags: article.tags.filter((current) => current !== tag) });
                            else if (article.tags.length < 3) update({ tags: [...article.tags, tag] });
                          }}
                        >
                          {tagLabel(tag, language)}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3 p-5">
                <Button type="button" variant="outline" className="w-full" onClick={() => setPreview(true)}>
                  {t.preview}
                </Button>
                <Button
                  type="button"
                  className="w-full"
                  disabled={submitting || dirty || saveState !== "saved"}
                  onClick={() => void submit()}
                >
                  {submitting ? t.submitting : t.submit}
                </Button>
                {submitMissing.length ? (
                  <div role="alert" className="space-y-1 text-sm text-destructive">
                    <p className="font-semibold">{t.missing}</p>
                    <ul className="list-disc pl-5">
                      {submitMissing.map((code) => (
                        <li key={code}>{missingLabel(code, t)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
      {preview || readOnly ? (
        <Button type="button" variant="outline" onClick={() => setPreview(false)}>
          {t.previewOff}
        </Button>
      ) : null}
    </div>
  );
}

function BlockInsert({
  t,
  open,
  onToggle,
  onSelect,
}: {
  t: (typeof articlesEditorStrings)["en"];
  open: boolean;
  onToggle: () => void;
  onSelect: (type: "paragraph" | "heading" | "quote" | "image" | "video") => void;
}) {
  return (
    <div className="relative flex justify-center py-2">
      <Button type="button" variant="outline" size="icon" aria-label={t.addBlock} onClick={onToggle}>
        <Plus aria-hidden="true" />
      </Button>
      {open ? <BlockMenu t={t} onSelect={onSelect} /> : null}
    </div>
  );
}

function BlockMenu({
  t,
  onSelect,
}: {
  t: (typeof articlesEditorStrings)["en"];
  onSelect: (type: "paragraph" | "heading" | "quote" | "image" | "video") => void;
}) {
  const choices = [
    ["paragraph", t.paragraph],
    ["heading", t.heading],
    ["quote", t.quote],
    ["image", t.image],
    ["video", t.video],
  ] as const;
  return (
    <div className="absolute bottom-full z-10 mb-2 grid w-48 gap-1 rounded-lg border bg-card p-2 shadow-lg">
      {choices.map(([type, label]) => (
        <button
          key={type}
          type="button"
          className="rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onSelect(type)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function EditorBlock({
  block,
  index,
  total,
  t,
  progress,
  uploadError,
  uploadUnavailable,
  onChange,
  onMove,
  onDelete,
  onUpload,
  onRetry,
}: {
  block: Block;
  index: number;
  total: number;
  t: (typeof articlesEditorStrings)["en"];
  progress?: number;
  uploadError?: boolean;
  uploadUnavailable?: boolean;
  onChange: (patch: Partial<Block>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
  onRetry: () => void;
}) {
  const isMedia = block.type === "image" || block.type === "video";
  const textPlaceholder =
    block.type === "heading" ? t.headingPlaceholder : block.type === "quote" ? t.quotePlaceholder : t.blockPlaceholder;
  return (
    <div className="group relative rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {block.type === "image"
            ? t.image
            : block.type === "video"
              ? t.video
              : block.type === "heading"
                ? t.heading
                : block.type === "quote"
                  ? t.quote
                  : t.paragraph}
        </span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label={t.moveUp} disabled={index === 0} onClick={() => onMove(index, -1)}>
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t.moveDown}
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label={t.removeBlock} onClick={onDelete}>
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
      {isMedia ? (
        <>
          <label
            htmlFor={`article-media-${block.id}`}
            className="flex min-h-28 cursor-pointer items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4 text-center hover:bg-accent focus-within:ring-2 focus-within:ring-ring"
          >
            {block.url ? (
              block.type === "image" ? (
                <img src={block.url} alt={block.caption || ""} className="max-h-72 w-full rounded-lg object-cover" />
              ) : (
                <video src={block.url} controls preload="metadata" className="max-h-72 w-full rounded-lg" />
              )
            ) : (
              <span className="flex items-center gap-2 text-sm">
                <Upload aria-hidden="true" />
                {block.type === "image" ? t.chooseFile : t.video}
              </span>
            )}
            <input
              id={`article-media-${block.id}`}
              type="file"
              accept={block.type === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm"}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {progress !== undefined && progress < 1 ? (
            <progress className="mt-3 h-2 w-full" max={1} value={progress} aria-label={block.type === "image" ? t.image : t.video} />
          ) : null}
          {uploadError ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {uploadUnavailable ? t.uploadUnavailable : t.uploadFailed}{" "}
              <Button type="button" variant="link" className="h-auto p-0" onClick={onRetry}>
                {t.retryUpload}
              </Button>
            </p>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`article-caption-${block.id}`}>{t.caption}</Label>
              <Input
                id={`article-caption-${block.id}`}
                value={block.caption ?? ""}
                maxLength={BLOCK_LIMITS.maxCaption}
                onChange={(event) => onChange({ caption: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor={`article-source-${block.id}`}>{t.source} *</Label>
              <Input
                id={`article-source-${block.id}`}
                value={block.source}
                maxLength={BLOCK_LIMITS.maxSource}
                className={block.source.trim() ? "" : "border-destructive focus-visible:ring-destructive"}
                aria-invalid={!block.source.trim()}
                onChange={(event) => onChange({ source: event.target.value })}
              />
              {!block.source.trim() ? <p className="mt-1 text-sm text-destructive">{t.sourceRequired}</p> : null}
            </div>
          </div>
        </>
      ) : (
        <AutoTextarea
          id={`article-block-${block.id}`}
          value={(block as TextBlock).text}
          maxLength={BLOCK_LIMITS.maxText}
          placeholder={textPlaceholder}
          onChange={(text) => onChange({ text })}
          className={block.type === "heading" ? "text-xl font-semibold" : block.type === "quote" ? "italic text-muted-foreground" : ""}
        />
      )}
    </div>
  );
}

function localMissingLabel(code: string, t: (typeof localStrings)["en"]) {
  if (code.startsWith("block.source:")) return t.missingImageSource;
  return ({ title: t.missingTitle, body: t.missingBody, blocks: t.missingBlocks, tags: t.missingTags,
    locality: t.missingLocality, scope: t.missingScope, happenedAt: t.missingDate, source: t.missingSource } as Record<string, string>)[code] || t.invalid;
}

// ponytail: Use the server's filed count when the daily-limit response gains that field.
function localError(cause: unknown, language: Language, count?: number) {
  const t = localStrings[language];
  if (cause instanceof ApiError) {
    const body = cause.body as { error?: string; missing?: string[]; limit?: number; resetsAt?: string } | null;
    if (body?.error === "daily_limit") return t.dailyLimit
      .replace("{n}", formatNumber(count ?? body.limit ?? 0, language))
      .replace("{time}", formatRelativeTime(body.resetsAt, language));
    if (body?.error === "reporter_required") return t.permission;
    if (body?.missing?.length) return body.missing.map((code) => localMissingLabel(code, t)).join(" ");
  }
  return apiErrorMessage(cause, language) || t.invalid;
}

function inputDate(iso: string | undefined) {
  if (!iso || Number.isNaN(Date.parse(iso))) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function LocalUpdateEditor({ language, id }: { language: Language; id: string }) {
  const t = localStrings[language];
  const auth = useGoogleAuth();
  const [currentId, setCurrentId] = useState(id === "new" ? null : id);
  const [status, setStatus] = useState<ArticleStatus>("draft");
  const [form, setForm] = useState<ArticleSaveBody>({ title: "", blocks: [], tags: ["community"], language, scope: "municipality", sourceUrls: [], sourceNote: "" });
  const [bodyText, setBodyText] = useState("");
  const [date, setDate] = useState("");
  const [district, setDistrict] = useState("");
  const [municipality, setMunicipality] = useState<number | "">("");
  const [ward, setWard] = useState("");
  const [image, setImage] = useState<MediaBlock | null>(null);
  const [loading, setLoading] = useState(id !== "new");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [sent, setSent] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const allowed = auth.profile?.role === "admin" || Boolean(auth.profile?.reporter?.approvedAt);
  const readOnly = status === "pending" || status === "published";
  const loadedFor = useRef<string | null>(null);
  const load = useCallback(async () => {
    if (!auth.idToken || !auth.profile) return;
    setError(null);
    setLoading(true);
    try {
      const home = auth.profile.reporter?.localities?.[0];
      if (id === "new") {
        setDistrict(home?.district || "");
        setMunicipality(home?.municipalityId ? Number(home.municipalityId) : "");
        setWard(home?.ward ? String(home.ward) : "");
        setForm((current) => ({ ...current, displayName: auth.profile?.displayName || auth.profile?.name || "", scope: home?.ward ? "ward" : "municipality" }));
      } else {
        const item = await getMyArticle(auth.idToken, id);
        if (item.kind !== "news") throw new Error();
        setCurrentId(item.id);
        setStatus(item.status);
        setForm(item);
        setBodyText(item.blocks.filter((block) => block.type === "paragraph").map((block) => (block as TextBlock).text).join("\n\n"));
        setDate(inputDate(item.happenedAt));
        setDistrict(item.locality?.district || "");
        setMunicipality(item.locality?.municipalityId ? Number(item.locality.municipalityId) : "");
        setWard(item.locality?.ward ? String(item.locality.ward) : "");
        setImage(item.blocks.find((block): block is MediaBlock => block.type === "image") || null);
        setRejectReason(item.rejectReason || "");
        setSaved(true);
      }
    } catch (cause) {
      setError(localError(cause, language));
    } finally {
      setLoading(false);
    }
  }, [auth.idToken, auth.profile, id, language]);
  useEffect(() => {
    if (!allowed || !auth.profile) return;
    const key = `${auth.profile.sub}:${id}`;
    // Token refreshes and chrome language changes must not reset an unsaved draft.
    // ponytail: Lift draft loading into a shared authoring hook when the editor grows another mode.
    if (loadedFor.current !== key) {
      loadedFor.current = key;
      void load();
    }
  }, [allowed, auth.profile, id, load]);

  const change = (patch: ArticleSaveBody) => { setForm((current) => ({ ...current, ...patch })); setSaved(false); setMissing([]); setError(null); };
  const dirty = () => { setSaved(false); setMissing([]); setError(null); };
  const validate = () => {
    const codes: string[] = [];
    if (!form.title?.trim() || form.title.trim().length > 200) codes.push("title");
    if (!bodyText.trim() || bodyText.trim().length > 1200) codes.push("body");
    const unit = municipalityById(municipality === "" ? undefined : municipality);
    if (!unit || unit.district !== district || (ward && (!Number.isInteger(Number(ward)) || Number(ward) < 1 || Number(ward) > unit.wards))) codes.push("locality");
    if (!form.scope || (form.scope === "ward" && !ward)) codes.push("scope");
    if (!date || Number.isNaN(Date.parse(date)) || Date.parse(date) > Date.now()) codes.push("happenedAt");
    const urls = (form.sourceUrls || []).map((url) => url.trim()).filter(Boolean);
    if ((!urls.length && !form.sourceNote?.trim()) || urls.length > 3 || (form.sourceNote || "").length > 200 || /[\r\n]/.test(form.sourceNote || "") || urls.some((url) => {
      try { const parsed = new URL(url); return !/^https:\/\/[^\s]{4,500}$/.test(url) || parsed.protocol !== "https:" || !parsed.hostname || Boolean(parsed.username || parsed.password); } catch { return true; }
    })) codes.push("source");
    if (bodyText.trim().split(/\n\s*\n/).length + (image ? 1 : 0) > BLOCK_LIMITS.maxBlocks) codes.push("blocks");
    if (form.tags?.length !== 1 || !DISPATCH_TAGS.includes(form.tags[0])) codes.push("tags");
    if (image && (!image.url || !image.fileId || !image.source.trim())) codes.push("block.source:0");
    setMissing(codes);
    return codes.length === 0;
  };
  const save = async () => {
    if (!auth.idToken || !allowed || busy || uploading || !validate()) return;
    setBusy(true);
    setError(null);
    try {
      const blocks: Block[] = bodyText.trim().split(/\n\s*\n/).map((text) => ({ type: "paragraph", text: text.trim() }));
      if (image) blocks.push(image);
      const payload: ArticleSaveBody & { language: Language } = {
        title: form.title?.trim(), blocks: trimBlocks(blocks), language: form.language || language, tags: form.tags, scope: form.scope,
        locality: { district, municipalityId: String(municipality), ...(ward ? { ward: Number(ward) } : {}) },
        happenedAt: new Date(date).toISOString(), sourceUrls: (form.sourceUrls || []).map((url) => url.trim()).filter(Boolean), sourceNote: form.sourceNote?.trim() || "", displayName: form.displayName,
      };
      if (currentId) await saveArticle(auth.idToken, currentId, payload);
      else {
        const result = await createArticle(auth.idToken, { ...payload, kind: "news" });
        setCurrentId(result.id);
        window.history.replaceState({}, "", `/me/articles/${encodeURIComponent(result.id)}/edit?kind=news`);
      }
      setSaved(true);
    } catch (cause) {
      let count: number | undefined;
      if (cause instanceof ApiError && cause.status === 429) {
        try {
          const result = await listMyArticles(auth.idToken);
          count = result.items.filter((item) => item.kind === "news" && Date.parse(item.createdAt) > Date.now() - 86400000).length;
        } catch { /* The server's limit is the fallback if the tally cannot load. */ }
      }
      setError(localError(cause, language, count));
    } finally { setBusy(false); }
  };
  const submit = async () => {
    if (!auth.idToken || !currentId || !saved || busy || uploading || !validate()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitArticle(auth.idToken, currentId);
      setStatus(result.status);
      setRejectReason("");
      setSent(true);
    } catch (cause) { setError(localError(cause, language)); }
    finally { setBusy(false); }
  };
  const upload = async (file: File) => {
    if (!auth.idToken) return;
    if (!(MEDIA_LIMITS.image.types as readonly string[]).includes(file.type) || file.size > MEDIA_LIMITS.image.maxBytes) {
      setError(t.uploadFailed);
      return;
    }
    setUploading(true);
    dirty();
    try {
      const result = await uploadMedia((payload) => presignArticleMedia(auth.idToken as string, payload), file, () => {});
      setImage({ type: "image", ...result, source: "", caption: "", id: uid() });
    } catch { setError(t.uploadFailed); }
    finally { setUploading(false); }
  };
  const fieldError = (code: string) => missing.includes(code) ? (
    <p id={`local-error-${code}`} role="alert" className="text-sm text-destructive">{localMissingLabel(code, t)}</p>
  ) : null;
  let bsDate = "";
  try { bsDate = date ? formatBsDate(new Date(date), language) : ""; }
  catch { bsDate = t.bsUnavailable; }

  if (auth.loading || (auth.idToken && !auth.profile && !auth.error) || (allowed && loading))
    return <LoadingState label={t.loading} />;
  if (!auth.idToken) return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t.title} />
      <SignInNudge language={language} id="local-update" title={t.title} body={t.permission} />
    </div>
  );
  if (!allowed) return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t.title} />
      <Alert><AlertDescription>{t.permission}</AlertDescription></Alert>
      <Button asChild><a href="/me">{t.back}</a></Button>
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t.title} />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error}{" "}
            <Button variant="outline" disabled={busy} onClick={() => {
              if (id !== "new" && !form.title) void load();
              else void save();
            }}>{t.retry}</Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {missing.length ? (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc space-y-2 pl-5">
              {missing.map((code) => <li key={code}>{localMissingLabel(code, t)}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {rejectReason ? <Alert variant="destructive"><AlertDescription>{t.rejectedReason}: {rejectReason}</AlertDescription></Alert> : null}
      <StatusBadge tone={toneForStatus(status)}>
        {({ draft: t.statusDraft, pending: t.statusPending, published: t.statusPublished, rejected: t.statusRejected })[status]}
      </StatusBadge>
      {sent ? <Alert><AlertDescription>{t.submitted}</AlertDescription></Alert> : null}
      {readOnly ? <p>{status === "published" ? t.statusPublished : t.readOnly}</p> : saved ? <Alert><AlertDescription>{t.saved}</AlertDescription></Alert> : null}
      <Card>
        <CardHeader><CardTitle><h2>{t.body}</h2></CardTitle></CardHeader>
        <CardContent>
          <fieldset disabled={busy || uploading || readOnly} className="min-w-0 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="local-title">{t.titleLabel}</Label>
              <Input id="local-title" value={form.title || ""} maxLength={200}
                aria-invalid={missing.includes("title")} aria-describedby={missing.includes("title") ? "local-error-title" : undefined}
                onChange={(event) => change({ title: event.target.value })} />
              {fieldError("title")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="local-body">{t.body}</Label>
              <Textarea id="local-body" rows={6} maxLength={1200} value={bodyText}
                aria-invalid={missing.includes("body")} aria-describedby={`local-body-hint${missing.includes("body") ? " local-error-body" : ""}`}
                onChange={(event) => { setBodyText(event.target.value); dirty(); }} />
              <p id="local-body-hint" className="text-sm text-muted-foreground">{t.bodyHint}</p>
              {fieldError("body")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="local-language">{t.language}</Label>
              <NativeSelect id="local-language" value={form.language} onChange={(event) => change({ language: event.target.value as Language })}>
                <NativeSelectOption value="en">{t.english}</NativeSelectOption>
                <NativeSelectOption value="ne">{t.nepali}</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="local-district">{t.district}</Label>
              <NativeSelect id="local-district" value={district} aria-invalid={missing.includes("locality")}
                onChange={(event) => { setDistrict(event.target.value); setMunicipality(""); setWard(""); dirty(); }}>
                <NativeSelectOption value="">{t.chooseDistrict}</NativeSelectOption>
                {districtNames.map((name) => <NativeSelectOption key={name} value={name}>{districtLabels[name][language]}</NativeSelectOption>)}
              </NativeSelect>
            </div>
            {/* ponytail: Replace MunicipalitySelect and ward input with the gated LocalityPicker when T8 ships. */}
            <MunicipalitySelect id="local-municipality" district={district} value={municipality}
              onChange={(value) => { setMunicipality(value); setWard(""); dirty(); }} language={language}
              label={t.municipality} placeholder={t.chooseMunicipality} districtFirst={t.districtFirst} typeLabels={t}
              error={missing.includes("locality") ? t.missingLocality : undefined} />
            <div className="space-y-2">
              <Label htmlFor="local-ward">{t.ward}</Label>
              <Input id="local-ward" type="number" min={1} max={municipalityById(Number(municipality))?.wards} step={1} value={ward}
                aria-invalid={missing.includes("locality") || missing.includes("scope")}
                onChange={(event) => { setWard(event.target.value); dirty(); }} />
            </div>
            <fieldset className="min-w-0">
              <legend className="text-sm font-medium">{t.scope}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {([
                  ["ward", t.scopeWard], ["municipality", t.scopeMunicipality], ["district", t.scopeDistrict], ["national", t.scopeNational],
                ] as const).map(([value, label]) => (
                  <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2">
                    <input type="radio" name="local-scope" value={value} checked={form.scope === value}
                      onChange={() => change({ scope: value })} className="size-5 shrink-0 accent-primary" />
                    {label}
                  </label>
                ))}
              </div>
              {fieldError("scope")}
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="local-date">{t.happenedAt}</Label>
              <Input id="local-date" type="datetime-local" value={date} max={inputDate(new Date().toISOString())} className="min-w-0"
                aria-invalid={missing.includes("happenedAt")} aria-describedby={`local-bs-date${missing.includes("happenedAt") ? " local-error-happenedAt" : ""}`}
                onChange={(event) => { setDate(event.target.value); dirty(); }} />
              <p id="local-bs-date" className="text-sm text-muted-foreground">{bsDate}</p>
              {fieldError("happenedAt")}
            </div>
            <fieldset className="min-w-0 space-y-3">
              <legend className="text-sm font-medium">{t.sources}</legend>
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`local-source-${index}`}>{t.sourceUrl.replace("{n}", formatNumber(index + 1, language))}</Label>
                  <Input id={`local-source-${index}`} type="url" maxLength={500} value={form.sourceUrls?.[index] || ""}
                    aria-invalid={missing.includes("source")} onChange={(event) => {
                      const sourceUrls = [...(form.sourceUrls || [])];
                      sourceUrls[index] = event.target.value;
                      change({ sourceUrls });
                    }} />
                </div>
              ))}
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="local-source-note">{t.sourceNote}</Label>
              <Input id="local-source-note" maxLength={200} value={form.sourceNote || ""} placeholder={t.sourcePlaceholder}
                aria-invalid={missing.includes("source")} aria-describedby={missing.includes("source") ? "local-error-source" : undefined}
                onChange={(event) => change({ sourceNote: event.target.value })} />
              <p className="text-sm text-muted-foreground">{t.sourceHint}</p>
              {fieldError("source")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="local-tag">{t.tag}</Label>
              <NativeSelect id="local-tag" value={form.tags?.[0] || ""} aria-invalid={missing.includes("tags")}
                onChange={(event) => change({ tags: [event.target.value as DispatchTag] })}>
                {DISPATCH_TAGS.map((tag) => <NativeSelectOption key={tag} value={tag}>{tagLabel(tag, language)}</NativeSelectOption>)}
              </NativeSelect>
              {fieldError("tags")}
            </div>
            <div className="space-y-3">
              <Label htmlFor="local-image">{t.image}</Label>
              <Input id="local-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.currentTarget.value = "";
              }} />
              {image ? (
                <>
                  <img src={image.url} alt={image.caption || ""} className="w-full rounded-lg" />
                  <Label htmlFor="local-image-source">{t.imageSource}</Label>
                  <Input id="local-image-source" value={image.source} maxLength={200}
                    aria-invalid={missing.includes("block.source:0")} onChange={(event) => { setImage({ ...image, source: event.target.value }); dirty(); }} />
                  <Label htmlFor="local-image-caption">{t.imageCaption}</Label>
                  <Input id="local-image-caption" value={image.caption || ""} maxLength={300}
                    onChange={(event) => { setImage({ ...image, caption: event.target.value }); dirty(); }} />
                  {fieldError("block.source:0")}
                  <Button type="button" variant="outline" onClick={() => { setImage(null); dirty(); }}>{t.removeImage}</Button>
                </>
              ) : null}
            </div>
          </fieldset>
        </CardContent>
      </Card>
      {uploading ? <p role="status">{t.uploading}</p> : null}
      {!readOnly ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="h-auto min-h-11 whitespace-normal py-3" variant={saved ? "outline" : "default"}
            disabled={busy || uploading} onClick={() => void save()}>{busy ? t.saving : t.save}</Button>
          <Button size="lg" className="h-auto min-h-11 whitespace-normal py-3" variant={saved ? "default" : "outline"}
            disabled={busy || uploading || !saved} onClick={() => void submit()}>{t.submit}</Button>
        </div>
      ) : null}
      <Button asChild className="h-auto min-h-11 whitespace-normal py-3" variant={readOnly ? "default" : "outline"}>
        <a href="/me#local-updates">{t.back}</a>
      </Button>
    </div>
  );
}
