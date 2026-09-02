import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { districtLabels, districtNames } from "@/lib/geo";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";
import type { DeskModel } from "./use-desk";

function QrCell({ code, alt }: { code: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void import("qrcode")
      .then((module) => module.default.toDataURL(code, { width: 64, margin: 1 }))
      .then((value) => {
        if (active) setSrc(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [code]);
  return src ? (
    <img src={src} width={64} height={64} alt={alt} className="size-16 object-contain" />
  ) : (
    <Badge variant="outline" className="font-mono">
      {code}
    </Badge>
  );
}

export function PrintClaims({ model }: { model: DeskModel }) {
  const districtOptions = model.isScoped ? model.scopeDistricts : districtNames;
  return (
    <SectionFrame
      title={model.t.deskPrintTitle}
      description={model.ds.deskPrintDescription}
      refresh={model.loadPrint}
      refreshLabel={model.ds.deskRefresh}
    >
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 sm:grid-cols-[minmax(12rem,1fr)_minmax(8rem,0.5fr)_auto_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="print-district">{model.t.deskPrintDistrict}</Label>
              <NativeSelect
                id="print-district"
                value={model.printDistrict}
                onChange={(event) => model.setPrintDistrict(event.target.value)}
              >
                {districtOptions.map((district) => (
                  <NativeSelectOption key={district} value={district}>
                    {districtLabels[district as keyof typeof districtLabels]?.[model.language] ?? district}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="print-ward">{model.t.deskPrintWard}</Label>
              <NativeSelect id="print-ward" value={model.printWard} onChange={(event) => model.setPrintWard(event.target.value)}>
                {Array.from({ length: 33 }, (_, index) => index + 1).map((ward) => (
                  <NativeSelectOption key={ward} value={String(ward)}>
                    W{ward}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <Button onClick={model.loadPrint} disabled={model.printLoading}>
              {model.t.deskPrintLoad}
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!model.printItems.length}>
              <Printer aria-hidden="true" />
              {model.t.deskPrintPrintAction}
            </Button>
          </div>
          {model.printError ? <SectionError message={model.printError} retry={model.loadPrint} /> : null}
          {model.printLoading ? (
            <SectionLoading label={model.t.deskBoardsLoading} />
          ) : !model.printError && !model.printItems.length ? (
            <SectionEmpty icon={Printer} title={model.t.deskPrintEmpty} />
          ) : null}
          {model.printItems.length ? (
            <div id="print-sheet" className="rounded-xl border bg-background p-4">
              <div className="mb-4 text-center">
                <h3 className="text-xl font-bold">
                  {model.printDistrict} · W{model.printWard}
                </h3>
                <p className="text-sm text-muted-foreground">{model.ds.deskPrintSheetLabel}</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{model.t.deskPrintTick}</TableHead>
                    <TableHead>{model.t.deskPrintQr}</TableHead>
                    <TableHead>{model.t.deskPrintCode}</TableHead>
                    <TableHead>{model.t.deskPrintMaskedName}</TableHead>
                    <TableHead>{model.t.deskPrintCategory}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.printItems.map((item) => (
                    <TableRow key={item.claimCode} className="break-inside-avoid">
                      <TableCell className="text-center text-xl">□</TableCell>
                      <TableCell>
                        <QrCell code={item.claimCode} alt={model.ds.deskPrintQrAlt.replace("{code}", item.claimCode)} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono font-bold tracking-widest">
                          {item.claimCode}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.maskedName}</TableCell>
                      <TableCell>{item.category}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <style>{`@media print { body * { visibility: hidden } #print-sheet, #print-sheet * { visibility: visible } #print-sheet { position: absolute; inset: 0 } }`}</style>
    </SectionFrame>
  );
}
