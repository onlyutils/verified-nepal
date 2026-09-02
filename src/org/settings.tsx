import { Copy, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { districtLabels } from "@/lib/geo";
import type { OrgController } from "./org-types";

export function SettingsSection({ controller }: { controller: OrgController }) {
  const { selectedOrg, t, language } = controller;
  if (!selectedOrg) return null;
  const districts = selectedOrg.districts
    .map((district) => districtLabels[district as keyof typeof districtLabels]?.[language] ?? district)
    .join(" · ");
  const openEditor = () => {
    controller.setEditForm({
      name: selectedOrg.name,
      orgType: selectedOrg.orgType,
      registrationNumber: selectedOrg.registrationNumber ?? "",
      contactName: selectedOrg.contactName,
      contactPhone: selectedOrg.contactPhone,
      contactEmail: selectedOrg.contactEmail ?? "",
      districts: selectedOrg.districts,
      description: selectedOrg.description,
      website: selectedOrg.website ?? "",
    });
    controller.setEditOpen(true);
  };
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader eyebrow={t.navSettings} title={t.navSettings} description={t.settingsDescription} />
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>{t.settingsOrganizationDetails}</CardTitle>
            <CardDescription className="mt-1">{t[`orgType_${selectedOrg.orgType}`]}</CardDescription>
          </div>
          {controller.isOwner ? (
            <Button variant="outline" onClick={openEditor}>
              <Pencil />
              {t.orgEditButton}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium">{t.registerOrgContactNameLabel}</p>
            <p className="text-muted-foreground">{selectedOrg.contactName}</p>
          </div>
          <div>
            <p className="font-medium">{t.registerOrgContactPhoneLabel}</p>
            <p className="text-muted-foreground">{selectedOrg.contactPhone}</p>
          </div>
          <div>
            <p className="font-medium">{t.registerOrgDistrictsLabel}</p>
            <p className="text-muted-foreground">{districts}</p>
          </div>
          <div>
            <p className="font-medium">{t.registerOrgContactEmailLabel}</p>
            <p className="text-muted-foreground">{selectedOrg.contactEmail ?? t.notAvailable}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="font-medium">{t.orgDescriptionLabel}</p>
            <p className="mt-1 text-muted-foreground">{selectedOrg.description}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.orgIdTitle}</CardTitle>
          <CardDescription>{t.orgIdDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 break-all rounded-md border bg-secondary p-3 font-mono text-sm">{selectedOrg.id}</code>
          <Button variant="outline" onClick={() => void controller.copyOrgId()}>
            <Copy />
            {controller.copiedOrgId ? t.copied : t.copyId}
          </Button>
        </CardContent>
      </Card>
      {selectedOrg.status === "verified" && controller.isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.settingsVouching}</CardTitle>
            <CardDescription>{t.vouchBoxBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="settingsVouchTarget">{t.vouchInputLabel}</Label>
              <Input
                id="settingsVouchTarget"
                value={controller.vouchTargetId}
                onChange={(event) => controller.setVouchTargetId(event.target.value)}
                placeholder={t.vouchInputPlaceholder}
              />
            </div>
            <Button onClick={() => void controller.vouch()} disabled={controller.vouchSubmitting}>
              {controller.vouchSubmitting ? t.vouchSubmitting : t.vouchButton}
            </Button>
            {controller.vouchError ? (
              <p className="text-sm text-destructive" role="alert">
                {controller.vouchError}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function DistrictCheckboxes({
  controller,
  value,
  onChange,
  errorId,
}: {
  controller: OrgController;
  value: string[];
  onChange: (district: string) => void;
  errorId?: string;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {Object.entries(districtLabels).map(([district, labels]) => (
        <div key={district} className="flex min-h-11 items-center gap-2">
          <Checkbox
            id={`district-${district}`}
            checked={value.includes(district)}
            onCheckedChange={() => onChange(district)}
            aria-describedby={errorId}
          />
          <Label htmlFor={`district-${district}`}>{labels[controller.language]}</Label>
        </div>
      ))}
    </div>
  );
}
