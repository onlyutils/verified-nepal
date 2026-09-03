import { BLOCK_LIMITS } from "./types.ts";
import type { Block, Cover } from "./types.ts";

export type ArticleMissingCode = "title" | "cover" | "cover.source" | "paragraph" | `block.source:${number}` | "tags";

export interface ArticleValidationInput {
  title?: string;
  cover?: Cover | null;
  blocks?: Block[] | null;
  tags?: readonly string[] | null;
}

const ARTICLE_TAGS = new Set(["climate", "mountains", "floods", "landslides", "glaciers", "community", "story"]);

/** Trim editable block fields without changing block order or client-only ids. */
export function trimBlocks(blocks: readonly Block[] | null | undefined): Block[] {
  return (blocks ?? []).map((block) => {
    if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
      return { ...block, text: block.text.trim() };
    }
    if (block.type !== "image" && block.type !== "video") return block;
    const media = block;
    return {
      ...media,
      url: media.url.trim(),
      fileId: media.fileId.trim(),
      source: media.source.trim(),
      ...(media.caption === undefined ? {} : { caption: media.caption.trim() }),
    };
  });
}

export function trimCover(cover: Cover | null | undefined): Cover | null {
  if (!cover) return null;
  return {
    ...cover,
    url: cover.url.trim(),
    fileId: cover.fileId.trim(),
    source: cover.source.trim(),
    ...(cover.caption === undefined ? {} : { caption: cover.caption.trim() }),
  };
}

/** Client mirror of the server's strict submit checks. */
export function validateArticle({ title, cover, blocks, tags }: ArticleValidationInput): ArticleMissingCode[] {
  const missing: ArticleMissingCode[] = [];
  if (!title?.trim() || title.trim().length > BLOCK_LIMITS.maxTitle) missing.push("title");

  const normalizedCover = trimCover(cover);
  if (!normalizedCover || !normalizedCover.url || !normalizedCover.fileId) missing.push("cover");
  else if (!normalizedCover.source) missing.push("cover.source");

  const normalizedBlocks = trimBlocks(blocks);
  if (!normalizedBlocks.some((block) => block.type === "paragraph" && block.text.length > 0)) missing.push("paragraph");
  normalizedBlocks.forEach((block, index) => {
    if ((block.type === "image" || block.type === "video") && !block.source) missing.push(`block.source:${index}`);
  });

  const normalizedTags = tags ?? [];
  if (
    normalizedTags.length < 1 ||
    normalizedTags.length > 3 ||
    normalizedTags.some((tag) => typeof tag !== "string" || !ARTICLE_TAGS.has(tag)) ||
    new Set(normalizedTags).size !== normalizedTags.length
  ) {
    missing.push("tags");
  }
  return missing;
}
