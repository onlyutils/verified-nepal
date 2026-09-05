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
  rotated: boolean;
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
  const gridStep = 8;

  const withinEllipse = (px: number, py: number) => {
    const nx = (px - centerX) / centerX;
    const ny = (py - centerY) / centerY;
    return nx * nx + ny * ny <= 1;
  };
  const withinCanvas = (px: number, py: number) => px >= 0 && px <= opts.width && py >= 0 && py <= opts.height;

  // Every submitted message must show up, so placement always succeeds: try the nice round
  // cloud shape first, then a full-canvas grid scan, then shrink the word until it fits.
  function place(dimensions: { width: number; height: number }): { x: number; y: number } | undefined {
    const overlaps = (box: Box) => boxes.some((other) => intersects(box, other));

    for (let step = 0; step < 4000; step += 1) {
      const angle = step * 0.1;
      const radius = step * 1.5;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const box = paddedBox(x, y, dimensions.width, dimensions.height, padding);
      if (withinEllipse(box.left, box.top) && withinEllipse(box.right, box.top) &&
        withinEllipse(box.left, box.bottom) && withinEllipse(box.right, box.bottom) && !overlaps(box))
        return { x, y };
    }

    for (let y = dimensions.height / 2; y <= opts.height - dimensions.height / 2; y += gridStep) {
      for (let x = dimensions.width / 2; x <= opts.width - dimensions.width / 2; x += gridStep) {
        const box = paddedBox(x, y, dimensions.width, dimensions.height, padding);
        if (withinCanvas(box.left, box.top) && withinCanvas(box.right, box.bottom) && !overlaps(box)) return { x, y };
      }
    }
    return undefined;
  }

  sorted.forEach((word, index) => {
    const normalized = wMax === wMin ? 1 : Math.sqrt((word.weight - wMin) / (wMax - wMin));
    let size = opts.minSize + (opts.maxSize - opts.minSize) * normalized;
    // ponytail: every third word (after the top 2) goes vertical for visual variety, no smarter packing heuristic
    const rotated = index > 1 && index % 3 === 0;

    let dimensions: { width: number; height: number } | undefined;
    let found: { x: number; y: number } | undefined;
    while (size >= 8) {
      const measured = opts.measure(word.text, size);
      if (!Number.isFinite(measured.width) || !Number.isFinite(measured.height) || measured.width <= 0 || measured.height <= 0)
        return;
      const candidate = rotated ? { width: measured.height, height: measured.width } : measured;
      found = place(candidate);
      if (found) {
        dimensions = candidate;
        break;
      }
      size *= 0.85; // still no room at this size: shrink and try again rather than dropping the word
    }
    if (!found || !dimensions) return;

    boxes.push(paddedBox(found.x, found.y, dimensions.width, dimensions.height, padding));
    placed.push({
      text: word.text,
      weight: word.weight,
      x: found.x,
      y: found.y,
      size,
      width: dimensions.width,
      height: dimensions.height,
      rotated,
    });
  });

  return placed;
}
