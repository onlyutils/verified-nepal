import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { municipalitiesFor, municipalityLabel } from "@/lib/admin-units";
import type { Language } from "@/lib/types";

const TYPE_KEY: Record<string, "unitTypeRural" | "unitTypeMunicipality" | "unitTypeSubMetro" | "unitTypeMetro"> = {
  "Rural Municipality": "unitTypeRural",
  Municipality: "unitTypeMunicipality",
  "Submetropolitan City": "unitTypeSubMetro",
  "Metropolitan City": "unitTypeMetro",
};

export function MunicipalitySelect({
  id,
  district,
  value,
  onChange,
  language,
  label,
  placeholder,
  districtFirst,
  typeLabels,
  error,
}: {
  id: string;
  district: string;
  value: number | "";
  onChange: (id: number | "") => void;
  language: Language;
  label: string;
  placeholder: string;
  districtFirst: string;
  typeLabels: Record<"unitTypeRural" | "unitTypeMunicipality" | "unitTypeSubMetro" | "unitTypeMetro", string>;
  error?: string;
}) {
  const options = district ? municipalitiesFor(district) : [];
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} *</Label>
      <NativeSelect
        id={id}
        value={value === "" ? "" : String(value)}
        disabled={!district}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : "")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <NativeSelectOption value="">{district ? placeholder : districtFirst}</NativeSelectOption>
        {options.map((municipality) => (
          <NativeSelectOption key={municipality.id} value={String(municipality.id)}>
            {municipalityLabel(municipality, language)} ({typeLabels[TYPE_KEY[municipality.type]]})
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
