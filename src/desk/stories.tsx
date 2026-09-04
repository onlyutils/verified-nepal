import { useState } from "react";
import { Camera } from "lucide-react";
import { storyRoleLabel } from "@/i18n/articles-public";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";
import type { DeskModel } from "./use-desk";

export function Stories({ model }: { model: DeskModel }) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  return (
    <SectionFrame title={model.ds.deskStoriesTitle} description={model.ds.deskStoriesDescription} refresh={model.loadStories} refreshLabel={model.ds.deskRefresh}>
      {model.storiesLoading ? (
        <SectionLoading label={model.ds.deskStoriesLoading} />
      ) : model.storiesError ? (
        <SectionError message={model.storiesError} retry={model.loadStories} retryLabel={model.t.deskRetry} />
      ) : !model.stories.length ? (
        <SectionEmpty icon={Camera} title={model.ds.deskStoriesEmpty} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {model.stories.map((story) => (
            <Card key={story.id} className="flex flex-col">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{story.author.displayName}</CardTitle>
                  <Badge variant="outline">{storyRoleLabel(story.role, model.language)}</Badge>
                </div>
                <CardDescription>
                  {new Date(story.createdAt).toLocaleString()}
                  {story.author.email ? ` · ${story.author.email}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {story.media.type === "video" ? (
                  <video src={story.media.url} controls preload="metadata" className="aspect-[4/5] w-full rounded-lg bg-black object-contain" />
                ) : (
                  <img src={story.media.url} alt="" className="aspect-[4/5] w-full rounded-lg object-cover" />
                )}
                <p className="whitespace-pre-wrap text-sm leading-6">{story.caption}</p>
                <div className="mt-auto space-y-2">
                  <Input
                    value={reasons[story.id] ?? ""}
                    onChange={(e) => setReasons((r) => ({ ...r, [story.id]: e.target.value }))}
                    placeholder={model.ds.deskStoriesReasonPlaceholder}
                    maxLength={500}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void model.handleStoryModerate(story.id, "publish")}>
                      {model.t.deskDispatchesPublish}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void model.handleStoryModerate(story.id, "reject", reasons[story.id]?.trim() || undefined)}>
                      {model.t.deskDispatchesReject}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </SectionFrame>
  );
}
