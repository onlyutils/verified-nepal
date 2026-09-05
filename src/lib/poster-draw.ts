import { CURRENT_DISASTER } from "./disasters.ts";
import {
  coverRect,
  disasterLine,
  isPosterResolved,
  lastSeenLine,
  posterHeadline,
  posterNameLine,
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
  /** Full-bleed top/bottom bars. On "blue" this equals background, so the bar disappears. */
  bannerBg: string;
  bannerText: string;
  /** The name line and rules: the status colour on "paper", white on the flat "blue" card. */
  accent: string;
  text: string;
  muted: string;
  photoFrame: string;
  brand: string;
}

/** "paper" colours the banner by outcome; "blue" stays one flat colour regardless of status. */
function palette(template: PosterTemplateId, resolved: boolean): Palette {
  if (template === "blue") {
    const background = token("--primary");
    const bannerText = token("--primary-foreground");
    return {
      background,
      bannerBg: background,
      bannerText,
      accent: bannerText,
      text: bannerText,
      muted: token("--primary-foreground", 0.78),
      photoFrame: bannerText,
      brand: token("--primary-foreground", 0.9),
    };
  }
  const bannerBg = resolved ? token("--success") : token("--destructive");
  return {
    background: token("--secondary"),
    bannerBg,
    bannerText: resolved ? token("--success-foreground") : token("--destructive-foreground"),
    accent: bannerBg,
    text: token("--foreground"),
    muted: token("--muted-foreground"),
    photoFrame: token("--border"),
    brand: token("--muted-foreground"),
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

/** A label above a bold value; returns the y position after the value. */
function drawField(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
  labelColor: string,
  valueColor: string,
) {
  ctx.fillStyle = labelColor;
  ctx.font = `600 22px ${FAMILY}`;
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.fillStyle = valueColor;
  ctx.font = `700 34px ${FAMILY}`;
  return drawLines(ctx, wrapText(measure(ctx), value, w, 2), x, y + 32, 40);
}

export function drawPoster(canvas: HTMLCanvasElement, input: PosterInput, assets: PosterAssets, t: PosterStrings): void {
  const { width, height } = POSTER_SIZES[input.size];
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const story = input.size === "story";
  const resolved = isPosterResolved(input.status);
  const p = palette(input.template, resolved);
  const margin = 72;
  const contentW = width - margin * 2;

  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "top";

  // Status banner, full-bleed.
  const bannerH = story ? 190 : 150;
  ctx.fillStyle = p.bannerBg;
  ctx.fillRect(0, 0, width, bannerH);
  ctx.fillStyle = p.bannerText;
  ctx.font = `700 ${story ? 88 : 72}px ${FAMILY}`;
  ctx.textAlign = "center";
  ctx.fillText(posterHeadline(input.status, t), width / 2, bannerH / 2 - (story ? 44 : 36));

  // Name, centred, below the banner.
  ctx.fillStyle = p.accent;
  ctx.font = `700 ${story ? 56 : 44}px ${FAMILY}`;
  let y = bannerH + 36;
  const nameLines = wrapText(measure(ctx), posterNameLine(input), contentW, 2);
  for (const line of nameLines) {
    ctx.fillText(line, width / 2, y);
    y += story ? 66 : 54;
  }
  ctx.textAlign = "left";

  // Disaster context, small and centred.
  ctx.fillStyle = p.muted;
  ctx.font = `600 24px ${FAMILY}`;
  ctx.textAlign = "center";
  y += 4;
  for (const line of wrapText(measure(ctx), disasterLine(CURRENT_DISASTER, input.district, input.language, t, input.status), contentW, 2)) {
    ctx.fillText(line, width / 2, y);
    y += 32;
  }
  ctx.textAlign = "left";
  y += 20;
  ctx.fillStyle = p.accent;
  ctx.fillRect(margin, y, contentW, 4);
  y += 32;

  // Photo (left on a feed post, on top for a story) + labelled fact rows.
  let detailX = margin;
  let detailW = contentW;
  let detailY = y;
  let photoBottom: number;
  if (!story) {
    const photoW = Math.round(contentW * 0.42);
    const photoH = 480;
    drawPhoto(ctx, assets.photo, margin, y, photoW, photoH, p.photoFrame);
    detailX = margin + photoW + 40;
    detailW = contentW - photoW - 40;
    photoBottom = y + photoH;
  } else {
    const photoH = 620;
    drawPhoto(ctx, assets.photo, margin, y, contentW, photoH, p.photoFrame);
    detailY = y + photoH + 32;
    photoBottom = detailY;
  }

  let fy = detailY;
  if (input.age.trim() || input.gender) {
    const half = (detailW - 32) / 2;
    const ageBottom = drawField(ctx, t.age, input.age.trim() || "—", detailX, fy, half, p.muted, p.text);
    const genderBottom = drawField(ctx, t.gender, input.gender ? t[input.gender] : "—", detailX + half + 32, fy, half, p.muted, p.text);
    fy = Math.max(ageBottom, genderBottom) + 16;
    ctx.fillStyle = p.accent;
    ctx.fillRect(detailX, fy, detailW, 2);
    fy += 24;
  }
  const lastSeen = lastSeenLine(input, t, false);
  if (lastSeen) {
    fy = drawField(ctx, t.lastSeen, lastSeen, detailX, fy, detailW, p.muted, p.text) + 16;
    ctx.fillStyle = p.accent;
    ctx.fillRect(detailX, fy, detailW, 2);
    fy += 24;
  }
  if (input.clothing.trim()) {
    fy = drawField(ctx, t.marks, input.clothing.trim(), detailX, fy, detailW, p.muted, p.text) + 16;
  }

  // Short message, plain text under the photo/details block.
  let sy = Math.max(fy, photoBottom + 32) + 8;
  if (input.story.trim()) {
    ctx.fillStyle = p.text;
    ctx.font = `400 28px ${FAMILY}`;
    sy = drawLines(ctx, wrapText(measure(ctx), input.story.trim(), contentW, story ? 5 : 2), margin, sy, 38);
  }

  // Footer: full-bleed phone bar, then the brand line beneath it.
  const footerH = 110;
  const footerY = height - footerH - 60;
  const phones = input.phones
    .map((s) => s.trim())
    .filter(Boolean)
    .join("  ·  ");
  ctx.fillStyle = p.accent;
  ctx.fillRect(margin, footerY - 24, contentW, 2);
  ctx.fillStyle = p.bannerBg;
  ctx.fillRect(0, footerY, width, footerH);
  ctx.fillStyle = p.bannerText;
  ctx.font = `700 44px ${FAMILY}`;
  ctx.textAlign = "center";
  ctx.fillText(phones, width / 2, footerY + footerH / 2 - 22);

  const brandY = height - 48;
  ctx.fillStyle = p.brand;
  ctx.font = `600 24px ${FAMILY}`;
  ctx.fillText(t.brandUrl, width / 2, brandY);
  ctx.textAlign = "left";
}
