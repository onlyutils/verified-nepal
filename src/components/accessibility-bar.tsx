import { useEffect, useState } from "react";
import { labels } from "@/i18n";
import { shellStrings } from "@/i18n/shell";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";

const textScales = [100, 112.5, 125, 137.5, 150] as const;
const defaultScale = 100;

export function AccessibilityBar({ language }: { language: Language }) {
  const t = labels[language];
  const ts = shellStrings[language];
  const [scale, setScale] = useState<number>(() => {
    const stored = Number(localStorage.getItem("vn:text-scale"));
    return (textScales as readonly number[]).includes(stored) ? stored : defaultScale;
  });
  const [contrast, setContrast] = useState<"normal" | "high">(() => (localStorage.getItem("vn:contrast") === "high" ? "high" : "normal"));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.fontSize = scale === defaultScale ? "" : `${scale}%`;
    if (scale === defaultScale) localStorage.removeItem("vn:text-scale");
    else localStorage.setItem("vn:text-scale", String(scale));
  }, [scale]);

  useEffect(() => {
    document.documentElement.setAttribute("data-contrast", contrast);
    localStorage.setItem("vn:contrast", contrast);
  }, [contrast]);

  const index = textScales.indexOf(scale as (typeof textScales)[number]);
  const step = (delta: number) => setScale(textScales[Math.min(textScales.length - 1, Math.max(0, index + delta))]);
  const control = "min-h-11 min-w-11";

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-expanded={open}
        aria-controls="a11y-controls"
        aria-label={ts.accessibilityToggle}
        onClick={() => setOpen((value) => !value)}
      >
        Aa
      </Button>
      {open ? (
        <div
          id="a11y-controls"
          role="group"
          aria-label={t.accessibility}
          className="absolute right-0 top-12 z-40 flex w-[min(19rem,calc(100vw-2rem))] flex-wrap items-center gap-1 rounded-lg border bg-background p-2"
        >
          <span className="mr-1 px-2 text-xs font-semibold text-muted-foreground">{t.accessibility}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={control}
            onClick={() => step(-1)}
            disabled={index <= 0}
            aria-label={t.textSmaller}
          >
            A−
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={control}
            onClick={() => setScale(defaultScale)}
            aria-label={t.textReset}
          >
            A
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={control}
            onClick={() => step(1)}
            disabled={index >= textScales.length - 1}
            aria-label={t.textLarger}
          >
            A+
          </Button>
          <Button
            type="button"
            variant={contrast === "high" ? "default" : "outline"}
            size="sm"
            className="min-h-11 flex-1"
            onClick={() => setContrast(contrast === "high" ? "normal" : "high")}
            aria-pressed={contrast === "high"}
          >
            {t.highContrast}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
