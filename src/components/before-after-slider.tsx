import { useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { clipPercentFromPointer } from "@/lib/before-after-slider";

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel,
  afterLabel,
  overlayUrl,
  showOverlay = false,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel: string;
  afterLabel: string;
  overlayUrl?: string;
  showOverlay?: boolean;
}) {
  const [clip, setClip] = useState(50);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  function updateFromPointer(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setClip(clipPercentFromPointer(clientX, rect));
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-lg bg-muted"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromPointer(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        updateFromPointer(e.clientX);
      }}
    >
      {broken.after ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">{afterLabel}</div>
      ) : (
        <img src={afterUrl} alt={afterLabel} className="absolute inset-0 size-full object-cover" onError={() => setBroken((b) => ({ ...b, after: true }))} />
      )}
      {showOverlay && overlayUrl && !broken.overlay ? (
        <img
          src={overlayUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover opacity-70 mix-blend-multiply"
          onError={() => setBroken((b) => ({ ...b, overlay: true }))}
        />
      ) : null}
      {broken.before ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground" style={{ clipPath: `inset(0 ${100 - clip}% 0 0)` }}>
          {beforeLabel}
        </div>
      ) : (
        <img
          src={beforeUrl}
          alt={beforeLabel}
          className="absolute inset-0 size-full object-cover"
          style={{ clipPath: `inset(0 ${100 - clip}% 0 0)` }}
          onError={() => setBroken((b) => ({ ...b, before: true }))}
        />
      )}
      <div className="absolute inset-y-0 w-0.5 bg-background shadow" style={{ left: `${clip}%` }} aria-hidden="true">
        <span className="absolute left-1/2 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background shadow">
          <ChevronsLeftRight className="size-4" aria-hidden="true" />
        </span>
      </div>
      <span className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-0.5 text-xs font-medium">{beforeLabel}</span>
      <span className="absolute bottom-2 right-2 rounded bg-background/80 px-2 py-0.5 text-xs font-medium">{afterLabel}</span>
    </div>
  );
}
