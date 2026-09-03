import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { articlesEditorStrings } from "@/i18n/articles-editor";
import { communityStrings } from "@/i18n/community";
import {
  ApiError,
  DISPATCH_TAGS,
  getMyArticle,
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
import { BLOCK_LIMITS } from "./types";
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
