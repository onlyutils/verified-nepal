import { X } from "lucide-react";
import { useState } from "react";
import { districtLabels, districtNames } from "@/lib/geo";
import type { Language } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DistrictPicker({
  selected,
  onChange,
  language,
  searchPlaceholder,
}: {
  selected: string[];
  onChange: (districts: string[]) => void;
  language: Language;
  searchPlaceholder?: string;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visible = query ? districtNames.filter((district) => districtLabels[district][language].toLowerCase().includes(query)) : districtNames;
  return (
    <div className="space-y-3">
      {searchPlaceholder ? <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /> : null}
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((district) => (
            <Badge key={district} variant="secondary">
              {districtLabels[district as keyof typeof districtLabels]?.[language] ?? district}
              <Button type="button" variant="ghost" size="icon" className="ml-1 size-5 p-0" onClick={() => onChange(selected.filter((value) => value !== district))} aria-label={`${districtLabels[district as keyof typeof districtLabels]?.[language] ?? district} ×`}>
                <X aria-hidden="true" className="size-3" />
              </Button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-3">
        {visible.map((district) => (
          <Label key={district} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3">
            <Checkbox checked={selected.includes(district)} onCheckedChange={(checked) => onChange(checked ? [...selected, district] : selected.filter((value) => value !== district))} />
            {districtLabels[district][language]}
          </Label>
        ))}
      </div>
    </div>
  );
}
