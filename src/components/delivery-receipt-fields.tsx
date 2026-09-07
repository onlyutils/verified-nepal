import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { presignNeedMedia, type NeedMediaItem } from "@/lib/api";
import { tryGeolocate } from "@/lib/geolocation";
import { uploadMedia } from "@/lib/media";
import type { Language } from "@/lib/types";

export interface ReceiptValue {
  households?: number;
  photo?: NeedMediaItem;
  lat?: number;
  lng?: number;
}

export type ReceiptCopy = Record<"receiptTitle" | "receiptHouseholds" | "receiptPhoto" | "receiptLocation" | "receiptLocationSet" | "receiptPrivacy", string>;

export function DeliveryReceiptFields({
  value,
  onChange,
  language,
  token,
  t,
  idPrefix,
}: {
  value: ReceiptValue;
  onChange: (value: ReceiptValue) => void;
  language: Language;
  token: string;
  idPrefix: string;
  t: ReceiptCopy;
}) {
  const [uploading, setUploading] = useState(false);

  return (
    <fieldset className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{t.receiptTitle}</legend>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-households`}>{t.receiptHouseholds}</Label>
        <Input
          id={`${idPrefix}-households`}
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          value={value.households ?? ""}
          onChange={(event) => onChange({ ...value, households: event.target.value ? Number(event.target.value) : undefined })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-photo`}>{t.receiptPhoto}</Label>
        <FileInput
          id={`${idPrefix}-photo`}
          language={language}
          accept="image/*"
          disabled={uploading}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setUploading(true);
            try {
              const upload = await uploadMedia((body) => presignNeedMedia({ ...body, purpose: "receipt" }, token), file);
              onChange({ ...value, photo: { fileId: upload.fileId, type: "photo", originalUrl: upload.url } });
            } finally {
              setUploading(false);
            }
          }}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          const position = await tryGeolocate();
          if (position) onChange({ ...value, lat: position.lat, lng: position.lng });
        }}
      >
        {value.lat !== undefined ? t.receiptLocationSet : t.receiptLocation}
      </Button>
      <p className="text-xs text-muted-foreground">{t.receiptPrivacy}</p>
    </fieldset>
  );
}
