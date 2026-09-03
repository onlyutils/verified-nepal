export interface CloudWord {
  text: string;
  weight: number;
}

export interface PlacedWord {
  text: string;
  weight: number;
  x: number;
  y: number;
  size: number;
  width: number;
  height: number;
}

export interface LayoutOptions {
  width: number;
  height: number;
  minSize: number;
  maxSize: number;
  measure: (text: string, size: number) => { width: number; height: number };
  padding?: number;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function intersects(a: Box, b: Box) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function paddedBox(x: number, y: number, width: number, height: number, padding: number): Box {
  return {
    left: x - width / 2 - padding,
    top: y - height / 2 - padding,
    right: x + width / 2 + padding,
    bottom: y + height / 2 + padding,
  };
}

export function layoutWordCloud(words: CloudWord[], opts: LayoutOptions): PlacedWord[] {
  if (!words.length || opts.width <= 0 || opts.height <= 0) return [];

  const sorted = [...words].sort((a, b) => b.weight - a.weight || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
  const weights = sorted.map((word) => word.weight);
  const wMin = Math.min(...weights);
  const wMax = Math.max(...weights);
  const padding = opts.padding ?? 0;
  const placed: PlacedWord[] = [];
  const boxes: Box[] = [];
  const centerX = opts.width / 2;
  const centerY = opts.height / 2;

  for (const word of sorted) {
    const normalized = wMax === wMin ? 1 : Math.sqrt((word.weight - wMin) / (wMax - wMin));
    const size = opts.minSize + (opts.maxSize - opts.minSize) * normalized;
    const dimensions = opts.measure(word.text, size);
    if (!Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height) || dimensions.width <= 0 || dimensions.height <= 0)
      continue;

    const fits = (x: number, y: number) => {
      const box = paddedBox(x, y, dimensions.width, dimensions.height, padding);
      if (box.left < 0 || box.top < 0 || box.right > opts.width || box.bottom > opts.height) return false;
      return !boxes.some((other) => intersects(box, other));
    };
    let found: { x: number; y: number } | undefined;
    for (let step = 0; step < 4000; step += 1) {
      const angle = step * 0.1;
      const radius = step * 1.5;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      if (fits(x, y)) {
        found = { x, y };
        break;
      }
    }
    if (found) {
      boxes.push(paddedBox(found.x, found.y, dimensions.width, dimensions.height, padding));
    }
    if (found) {
      placed.push({
        text: word.text,
        weight: word.weight,
        x: found.x,
        y: found.y,
        size,
        width: dimensions.width,
        height: dimensions.height,
      });
    }
  }

  return placed;
}
