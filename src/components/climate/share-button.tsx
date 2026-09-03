import { Download, Share2 } from "lucide-react";
import { useState } from "react";
import { climateData, loadWorldGeoJson } from "@/lib/climate-data";
import { postClimateDownload } from "@/lib/api";
import { drawWorldMap, exportCanvas, renderShareCard, type ShareCardInput } from "@/lib/climate-share";
import { loadPosterFonts } from "@/lib/poster-draw";
import type { ClimateDownloadKind } from "@/lib/climate-messages";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ShareButton({
  kind,
  filename,
  headline,
  subline,
  message,
  footnote,
  draw,
  labels,
}: {
  kind: ClimateDownloadKind;
  filename: string;
  headline: string;
  subline?: string;
  message?: string;
  footnote?: string;
  draw?: ShareCardInput["draw"];
  labels: { download: string; share: string; exportError?: string };
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const canShare = typeof navigator !== "undefined" && "canShare" in navigator;

  const exportImage = async (share: boolean) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await loadPosterFonts();
      const canvas = document.createElement("canvas");
      let cardDraw = draw;
      if (kind === "map") {
        const geojson = await loadWorldGeoJson();
        cardDraw = (ctx, box) =>
          drawWorldMap(ctx, box, {
            geojson,
            countries: climateData.countries,
            highlightIso3: "NPL",
          });
      }
      const input: ShareCardInput = { headline, subline, message, footnote, draw: cardDraw };
      renderShareCard(canvas, input);
      const result = await exportCanvas(canvas, filename, { share });
      if (result === "downloaded" || result === "shared") void postClimateDownload(kind);
      if (result === "failed") setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" aria-busy={busy}>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void exportImage(false)}>
          <Download aria-hidden="true" />
          {labels.download}
        </Button>
        {canShare ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void exportImage(true)}>
            <Share2 aria-hidden="true" />
            {labels.share}
          </Button>
        ) : null}
      </div>
      {failed && labels.exportError ? (
        <Alert variant="destructive">
          <AlertDescription>{labels.exportError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
