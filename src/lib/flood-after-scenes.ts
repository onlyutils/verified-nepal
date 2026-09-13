import type { FloodAfterScenesData, FloodFrame } from "./flood-manifest";
export type { FloodAfterScenesData } from "./flood-manifest";

const DIACRITIC_MARKS = /[̀-ͯ]/g;

/** kebab-case, ASCII-only slug for a waypoint label. */
export function slugify(label: string): string {
  return label
    .normalize("NFKD")
    .replace(DIACRITIC_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isContextOnly(slug: string, data: FloodAfterScenesData): boolean {
  return data.contextOnly.includes(slug);
}

export function pinnedSceneId(slug: string, data: FloodAfterScenesData): string | null {
  if (isContextOnly(slug, data)) return null;
  return data.frameDefaults[slug] ?? null;
}

export function stopLabelNe(slug: string, data: FloodAfterScenesData): string | undefined {
  return data.labelsNe[slug];
}

export function selectStoryFrames(frames: FloodFrame[], data: FloodAfterScenesData): FloodFrame[] {
  return frames.filter((frame) => {
    const slug = slugify(frame.location.label);
    return isContextOnly(slug, data) || Object.hasOwn(data.frameDefaults, slug);
  });
}

export function storyStartIndex(frames: FloodFrame[], data: FloodAfterScenesData): number {
  const index = frames.findIndex((frame) => slugify(frame.location.label) === data.storyStart);
  return index >= 0 ? index : 0;
}
