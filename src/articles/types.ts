// Shared article block contract. Mirrored by server/src/lib/validate.js — keep the limits in sync.
export type TextBlockType = "paragraph" | "heading" | "quote";
export type MediaBlockType = "image" | "video";

export interface TextBlock {
  id?: string; // client-only React key; the server strips it
  type: TextBlockType;
  text: string;
}
export interface MediaBlock {
  id?: string;
  type: MediaBlockType;
  url: string;
  fileId: string;
  source: string; // required credit, shown as "Source: …"
  caption?: string;
}
export type Block = TextBlock | MediaBlock;

export interface Cover {
  url: string;
  fileId: string;
  source: string;
  caption?: string;
}

export const BLOCK_LIMITS = { maxBlocks: 60, maxText: 5000, maxSource: 200, maxCaption: 300, maxTitle: 200 } as const;

export const MEDIA_LIMITS = {
  image: { types: ["image/jpeg", "image/png", "image/webp"], maxBytes: 10 * 1024 * 1024 },
  video: { types: ["video/mp4", "video/webm"], maxBytes: 100 * 1024 * 1024 },
} as const;

export function isMediaBlock(b: Block): b is MediaBlock {
  return b.type === "image" || b.type === "video";
}
