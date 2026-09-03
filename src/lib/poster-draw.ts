import { CURRENT_DISASTER } from "./disasters.ts";
import {
  coverRect,
  disasterLine,
  lastSeenLine,
  personLine,
  POSTER_SIZES,
  wrapText,
  type PosterInput,
  type PosterStrings,
  type PosterTemplateId,
} from "./poster.ts";

export interface PosterAssets {
  photo: ImageBitmap | HTMLImageElement | null;
}

const FAMILY = "'Noto Sans', 'Noto Sans Devanagari', system-ui, sans-serif";

/** Read a colour token from styles.css ("0 56 147") so the poster follows the design system. */
export function token(name: string, alpha = 1) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `rgb(${raw} / ${alpha})` : `rgb(0 0 0 / ${alpha})`;
}

interface Palette {
  background: string;
  headline: string;
  headlineFound: string;
  text: string;
  muted: string;
  rule: string;
  photoFrame: string;
  brand: string;
}

function palette(template: PosterTemplateId): Palette {
  if (template === "blue") {
    return {
      background: token("--primary"),
      headline: token("--primary-foreground"),
      headlineFound: token("--primary-foreground"),
      text: token("--primary-foreground"),
      muted: token("--primary-foreground", 0.78),
      rule: token("--primary-foreground", 0.35),
      photoFrame: token("--primary-foreground"),
      brand: token("--primary-foreground", 0.9),
    };
  }
  return {
    background: token("--secondary"),
    headline: token("--destructive"),
    headlineFound: token("--success"),
    text: token("--foreground"),
    muted: token("--muted-foreground"),
    rule: token("--primary"),
    photoFrame: token("--border"),
    brand: token("--primary"),
  };
}

export async function loadPosterFonts(): Promise<void> {
  if (!("fonts" in document)) return;
  await Promise.allSettled(
    [
      "700 96px 'Noto Sans'",
      "600 40px 'Noto Sans'",
      "400 34px 'Noto Sans'",
      "700 96px 'Noto Sans Devanagari'",
      "400 34px 'Noto Sans Devanagari'",
    ].map((f) => document.fonts.load(f)),
  );
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

function drawPhoto(ctx: CanvasRenderingContext2D, photo: PosterAssets["photo"], x: number, y: number, w: number, h: number, frame: string) {
  ctx.save();
  roundedPath(ctx, x, y, w, h, 24);
  ctx.fillStyle = frame;
  ctx.fill();
  ctx.clip();
  if (photo) {
    const { sx, sy, sw, sh } = coverRect(photo.width, photo.height, w, h);
    ctx.drawImage(photo, sx, sy, sw, sh, x, y, w, h);
  }
  ctx.restore();
  ctx.save();
  roundedPath(ctx, x, y, w, h, 24);
  ctx.lineWidth = 6;
  ctx.strokeStyle = frame;
  ctx.stroke();
  ctx.restore();
}

/** Draws wrapped lines top-down; returns the y after the last line. */
function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function measure(ctx: CanvasRenderingContext2D) {
  return (s: string) => ctx.measureText(s).width;
}

export function drawPoster(canvas: HTMLCanvasElement, input: PosterInput, assets: PosterAssets, t: PosterStrings): void {
  const { width, height } = POSTER_SIZES[input.size];
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const p = palette(input.template);
  const margin = 72;
  const contentW = width - margin * 2;
  const found = input.status === "found";

  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "top";

  // Headline
  ctx.fillStyle = found ? p.headlineFound : p.headline;
  ctx.font = `700 ${input.size === "story" ? 120 : 96}px ${FAMILY}`;
  ctx.fillText(found ? t.headlineFound : t.headlineMissing, margin, margin);
  let y = margin + (input.size === "story" ? 140 : 112);

  // Disaster line
  ctx.fillStyle = p.muted;
  ctx.font = `600 30px ${FAMILY}`;
  y = drawLines(
    ctx,
    wrapText(measure(ctx), disasterLine(CURRENT_DISASTER, input.district, input.language, t, input.status), contentW, 2),
    margin,
    y,
    40,
  );
  y += 16;
  ctx.fillStyle = p.rule;
  ctx.fillRect(margin, y, 120, 6);
  y += 40;

  // Photo + details
  let textX = margin;
  let textW = contentW;
  if (input.size === "feed") {
    const photoW = 400;
    const photoH = 480;
    drawPhoto(ctx, assets.photo, margin, y, photoW, photoH, p.photoFrame);
    textX = margin + photoW + 48;
    textW = contentW - photoW - 48;
  } else {
    const photoH = 900;
    drawPhoto(ctx, assets.photo, margin, y, contentW, photoH, p.photoFrame);
    y += photoH + 48;
  }
  let ty = y;

  ctx.fillStyle = p.text;
  ctx.font = `700 ${input.size === "story" ? 64 : 52}px ${FAMILY}`;
  ty = drawLines(ctx, wrapText(measure(ctx), personLine(input, t), textW, 2), textX, ty, input.size === "story" ? 78 : 64);
  ty += 20;

  ctx.font = `400 34px ${FAMILY}`;
  ty = drawLines(ctx, wrapText(measure(ctx), lastSeenLine(input, t), textW, 3), textX, ty, 46);
  if (input.clothing.trim()) {
    ty += 8;
    ty = drawLines(ctx, wrapText(measure(ctx), input.clothing.trim(), textW, 2), textX, ty, 46);
  }
  if (input.story.trim()) {
    ty += 20;
    ctx.fillStyle = p.muted;
    ctx.font = `400 32px ${FAMILY}`;
    ty = drawLines(ctx, wrapText(measure(ctx), input.story.trim(), textW, input.size === "story" ? 6 : 3), textX, ty, 44);
  }

  // Contact block sits above the footer regardless of how much text there was.
  const footerH = 110;
  const contactY = height - footerH - 130;
  const phones = input.phones
    .map((s) => s.trim())
    .filter(Boolean)
    .join("  ·  ");
  ctx.fillStyle = p.muted;
  ctx.font = `600 28px ${FAMILY}`;
  ctx.fillText(t.contact.toUpperCase(), margin, contactY);
  ctx.fillStyle = p.text;
  ctx.font = `700 56px ${FAMILY}`;
  ctx.fillText(phones, margin, contactY + 38);

  // Footer brand: the domain only, small, centred, underlined.
  const brandY = height - 72;
  ctx.fillStyle = p.brand;
  ctx.font = `600 26px ${FAMILY}`;
  ctx.textAlign = "center";
  const label = t.brandUrl;
  const labelW = ctx.measureText(label).width;
  ctx.fillText(label, width / 2, brandY);
  ctx.fillRect(width / 2 - labelW / 2, brandY + 34, labelW, 2);
  ctx.textAlign = "left";
}
