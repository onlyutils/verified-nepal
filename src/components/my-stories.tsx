import { useCallback, useEffect, useState, type FormEvent } from "react";
import { meStrings } from "@/i18n/me";
import { storyRoleLabel } from "@/i18n/articles-public";
import { createStory, deleteStory, listMyStories, presignArticleMedia, type MyStory } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { MediaUploadError, uploadMedia } from "@/lib/media";
import type { Language } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, toneForStatus } from "@/components/status-badge";

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm";

export function MyStories({ language, token, eligible }: { language: Language; token: string | null; eligible: boolean }) {
  const t = meStrings[language];
  const [items, setItems] = useState<MyStory[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems((await listMyStories(token)).items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (e) {
      setError(apiErrorMessage(e, language));
    }
  }, [token, language]);
  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !file || !caption.trim()) return;
    setError(null);
    setSent(false);
    setProgress(0);
    try {
      const uploaded = await uploadMedia((body) => presignArticleMedia(token, body), file, setProgress);
      await createStory(token, { caption: caption.trim(), media: { type: file.type.startsWith("video/") ? "video" : "photo", ...uploaded } });
      setFile(null);
      setCaption("");
      setSent(true);
      event.currentTarget?.reset?.();
      await load();
    } catch (e) {
      setError(e instanceof MediaUploadError ? t.storyUploadFailed : apiErrorMessage(e, language));
    } finally {
      setProgress(null);
    }
  };

  const remove = async (story: MyStory) => {
    if (!token || !window.confirm(t.storyDeleteConfirm)) return;
    try {
      await deleteStory(token, story.id);
      setItems((current) => current.filter((s) => s.id !== story.id));
    } catch (e) {
      setError(apiErrorMessage(e, language));
    }
  };

  const statusLabel = { pending: t.storyStatusPending, published: t.storyStatusPublished, rejected: t.storyStatusRejected };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">{eligible ? t.storyEligibleBody : t.storyIneligibleBody}</p>
          {eligible ? (
            <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="story-media">{t.storyMedia}</Label>
                <Input id="story-media" type="file" accept={ACCEPT} required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-muted-foreground">{t.storyMediaHint}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="story-caption">{t.storyCaption}</Label>
                <Textarea id="story-caption" value={caption} maxLength={500} required rows={4} onChange={(e) => setCaption(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t.storyCaptionHint}</p>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={progress !== null || !file || !caption.trim()}>
                  {progress !== null ? `${t.storyUploading} ${Math.round(progress * 100)}%` : t.storyShare}
                </Button>
              </div>
            </form>
          ) : null}
          {sent ? <p role="status" className="text-sm">{t.storySent}</p> : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
      {items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((story) => (
            <li key={story.id}>
              <Card className="flex h-full flex-col overflow-hidden">
                {story.media.type === "video" ? (
                  <video src={story.media.url} controls preload="metadata" playsInline className="aspect-[4/5] w-full bg-black object-cover" />
                ) : (
                  <img src={story.media.url} alt="" className="aspect-[4/5] w-full object-cover" loading="lazy" />
                )}
                <CardContent className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={toneForStatus(story.status)}>{statusLabel[story.status]}</StatusBadge>
                    <Badge variant="outline">{storyRoleLabel(story.role, language)}</Badge>
                  </div>
                  <p className="line-clamp-4 text-sm leading-6">{story.caption}</p>
                  {story.rejectReason ? <p className="text-xs text-muted-foreground">{story.rejectReason}</p> : null}
                  <div className="mt-auto pt-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => void remove(story)}>
                      {t.storyDelete}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
