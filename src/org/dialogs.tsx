import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ORG_TYPES } from "@/lib/api";
import { districtLabels, districtNames } from "@/lib/geo";
import { GOODS_CATEGORIES, goodsLabel, unitLabel } from "@/lib/goods";
import { fillTemplate } from "@/lib/edition";
import { DistrictCheckboxes } from "./settings";
import type { OrgController } from "./org-types";

export function OrgDialogs({ controller }: { controller: OrgController }) {
  return (
    <>
      <CenterDialog controller={controller} />
      <OrganizationDialog controller={controller} />
      <ReceiveDialog controller={controller} />
      <CorrectionDialog controller={controller} />
      <DonationDialog controller={controller} />
      <RemoveDialog controller={controller} />
      <QrDialog controller={controller} />
    </>
  );
}

function CenterDialog({ controller }: { controller: OrgController }) {
  const { t, language, centerForm: form } = controller;
  const set = (patch: Partial<typeof form>) => controller.setCenterForm((state) => ({ ...state, ...patch }));
  const error = (key: string) =>
    controller.centerFormErrors[key] ? (
      <p className="text-sm text-destructive" role="alert">
        {controller.centerFormErrors[key]}
      </p>
    ) : null;
  return (
    <Dialog open={controller.centerFormOpen} onOpenChange={controller.setCenterFormOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.id ? t.editCenter : t.orgAddCenterTitle}</DialogTitle>
          <DialogDescription>{t.centerFormDescription}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void controller.submitCenter(event)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="centerName">{t.centerNameLabel} *</Label>
            <Input id="centerName" value={form.name} onChange={(event) => set({ name: event.target.value })} required />
            {error("name")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="centerDistrict">{t.centerDistrictLabel} *</Label>
              <NativeSelect id="centerDistrict" value={form.district} onChange={(event) => set({ district: event.target.value })} required>
                <NativeSelectOption value="">{t.centerSelectDistrict}</NativeSelectOption>
                {districtNames.map((district) => (
                  <NativeSelectOption key={district} value={district}>
                    {districtLabels[district][language]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {error("district")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="centerWard">{t.centerWardLabel}</Label>
              <Input
                id="centerWard"
                type="number"
                min="1"
                max="33"
                step="1"
                value={form.ward}
                onChange={(event) => set({ ward: event.target.value })}
              />
              {error("ward")}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="centerAddress">{t.centerAddressLabel} *</Label>
            <Textarea
              id="centerAddress"
              value={form.address}
              onChange={(event) => set({ address: event.target.value })}
              rows={2}
              required
            />
            {error("address")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="centerLat">{t.centerLatLabel}</Label>
              <Input id="centerLat" type="number" step="0.0001" value={form.lat} onChange={(event) => set({ lat: event.target.value })} />
              {error("lat")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="centerLng">{t.centerLngLabel}</Label>
              <Input id="centerLng" type="number" step="0.0001" value={form.lng} onChange={(event) => set({ lng: event.target.value })} />
              {error("lng")}
            </div>
          </div>
          {error("latLng")}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="centerHours">{t.centerHoursLabel}</Label>
              <Input id="centerHours" value={form.hours} onChange={(event) => set({ hours: event.target.value })} maxLength={200} />
              {error("hours")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="centerPhone">{t.centerContactPhoneLabel} *</Label>
              <Input
                id="centerPhone"
                inputMode="tel"
                value={form.contactPhone}
                onChange={(event) => set({ contactPhone: event.target.value })}
                required
              />
              {error("contactPhone")}
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t.centerAcceptsLabel} *</legend>
            <div className="flex flex-wrap gap-2">
              {GOODS_CATEGORIES.map((item) => (
                <label
                  key={item.id}
                  htmlFor={`accepts-${item.id}`}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${form.accepts.includes(item.id) ? "border-primary bg-primary-soft text-primary" : "bg-background"}`}
                >
                  <Checkbox
                    id={`accepts-${item.id}`}
                    checked={form.accepts.includes(item.id)}
                    onCheckedChange={() =>
                      set({
                        accepts: form.accepts.includes(item.id)
                          ? form.accepts.filter((value) => value !== item.id)
                          : [...form.accepts, item.id],
                      })
                    }
                  />
                  {goodsLabel(item.id, language)}
                </label>
              ))}
            </div>
            {error("accepts")}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="centerNotes">{t.centerNotesLabel}</Label>
            <Textarea
              id="centerNotes"
              value={form.notes}
              onChange={(event) => set({ notes: event.target.value })}
              rows={2}
              maxLength={500}
            />
            {error("notes")}
          </div>
          {controller.centerFormApiError ? (
            <Alert variant="destructive">
              <AlertDescription>{controller.centerFormApiError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => controller.setCenterFormOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={controller.centerSubmitting}>
              {controller.centerSubmitting
                ? form.id
                  ? t.centerEditSubmitting
                  : t.orgAddCenterSubmitting
                : form.id
                  ? t.centerEditSubmit
                  : t.orgAddCenterSubmit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrganizationDialog({ controller }: { controller: OrgController }) {
  const { t, editForm: form } = controller;
  const set = (patch: Partial<typeof form>) => controller.setEditForm((state) => ({ ...state, ...patch }));
  const error = (key: string) =>
    controller.editErrors[key] ? (
      <p className="text-sm text-destructive" role="alert">
        {controller.editErrors[key]}
      </p>
    ) : null;
  return (
    <Dialog open={controller.editOpen} onOpenChange={controller.setEditOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.orgEditTitle}</DialogTitle>
          <DialogDescription>{t.settingsOrganizationDetails}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void controller.submitEditOrg(event)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="editName">{t.registerOrgNameLabel} *</Label>
            <Input id="editName" value={form.name} onChange={(event) => set({ name: event.target.value })} required />
            {error("name")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="editType">{t.registerOrgOrgTypeLabel} *</Label>
            <NativeSelect
              id="editType"
              value={form.orgType}
              onChange={(event) => set({ orgType: event.target.value as typeof form.orgType })}
              required
            >
              <NativeSelectOption value="">{t.registerOrgSelectType}</NativeSelectOption>
              {ORG_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {t[`orgType_${type}`]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {error("orgType")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="editRegistration">{t.registerOrgRegistrationNumberLabel}</Label>
            <Input
              id="editRegistration"
              value={form.registrationNumber}
              onChange={(event) => set({ registrationNumber: event.target.value })}
            />
            {error("registrationNumber")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="editContactName">{t.registerOrgContactNameLabel} *</Label>
              <Input
                id="editContactName"
                value={form.contactName}
                onChange={(event) => set({ contactName: event.target.value })}
                required
              />
              {error("contactName")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="editContactPhone">{t.registerOrgContactPhoneLabel} *</Label>
              <Input
                id="editContactPhone"
                inputMode="tel"
                value={form.contactPhone}
                onChange={(event) => set({ contactPhone: event.target.value })}
                required
              />
              {error("contactPhone")}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="editContactEmail">{t.registerOrgContactEmailLabel}</Label>
            <Input
              id="editContactEmail"
              type="email"
              value={form.contactEmail}
              onChange={(event) => set({ contactEmail: event.target.value })}
            />
            {error("contactEmail")}
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t.registerOrgDistrictsLabel} *</legend>
            <DistrictCheckboxes
              controller={controller}
              value={form.districts}
              onChange={(district) =>
                set({
                  districts: form.districts.includes(district)
                    ? form.districts.filter((value) => value !== district)
                    : [...form.districts, district],
                })
              }
            />
            {error("districts")}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="editDescription">{t.registerOrgDescriptionLabel} *</Label>
            <Textarea
              id="editDescription"
              value={form.description}
              onChange={(event) => set({ description: event.target.value })}
              rows={4}
              maxLength={2000}
              required
            />
            <p className="text-xs text-muted-foreground">{t.registerOrgDescriptionHint}</p>
            {error("description")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="editWebsite">{t.registerOrgWebsiteLabel}</Label>
            <Input
              id="editWebsite"
              value={form.website}
              onChange={(event) => set({ website: event.target.value })}
              placeholder={t.websitePlaceholder}
              maxLength={200}
            />
            {error("website")}
          </div>
          {controller.editApiError ? (
            <Alert variant="destructive">
              <AlertDescription>{controller.editApiError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => controller.setEditOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={controller.editSubmitting}>
              {controller.editSubmitting ? t.orgEditSaving : t.orgEditSubmit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveDialog({ controller }: { controller: OrgController }) {
  const { t, dialogs, language } = controller;
  const dialog = dialogs.receive;
  return (
    <Dialog
      open={dialog.open}
      onOpenChange={(open) => {
        if (!open) controller.setDialogs((state) => ({ ...state, receive: { ...state.receive, open: false } }));
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.inboundDialogTitle}</DialogTitle>
          <DialogDescription>{t.inboundDialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receivedQty">{t.inboundQtyReceivedLabel} *</Label>
            <Input
              id="receivedQty"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={dialog.qtyReceived}
              onChange={(event) =>
                controller.setDialogs((state) => ({ ...state, receive: { ...state.receive, qtyReceived: event.target.value } }))
              }
            />
            {dialog.transfer && dialog.qtyReceived && Number(dialog.qtyReceived) !== dialog.transfer.qty ? (
              <p className="text-sm text-destructive">
                {fillTemplate(t.inboundDiscrepancy, {
                  value: String(dialog.transfer.qty - Number(dialog.qtyReceived)),
                  unit: unitLabel(dialog.transfer.unit, language),
                })}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="receivedNote">{t.inboundNoteLabel}</Label>
            <Textarea
              id="receivedNote"
              value={dialog.note}
              onChange={(event) =>
                controller.setDialogs((state) => ({ ...state, receive: { ...state.receive, note: event.target.value } }))
              }
              rows={2}
              maxLength={500}
            />
          </div>
          {dialog.error ? (
            <Alert variant="destructive">
              <AlertDescription>{dialog.error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => controller.setDialogs((state) => ({ ...state, receive: { ...state.receive, open: false } }))}
          >
            {t.cancel}
          </Button>
          <Button onClick={() => void controller.receiveTransfer()} disabled={dialog.submitting}>
            {dialog.submitting ? t.inboundSubmitting : t.inboundSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CorrectionDialog({ controller }: { controller: OrgController }) {
  const { t, dialogs } = controller;
  const dialog = dialogs.correction;
  return (
    <Dialog
      open={dialog.open}
      onOpenChange={(open) => {
        if (!open) controller.setDialogs((state) => ({ ...state, correction: { ...state.correction, open: false } }));
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.correctionDialogTitle}</DialogTitle>
          <DialogDescription>{t.correctionDialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="correctionNote">{t.correctionNoteLabel}</Label>
          <Textarea
            id="correctionNote"
            value={dialog.note}
            onChange={(event) =>
              controller.setDialogs((state) => ({ ...state, correction: { ...state.correction, note: event.target.value } }))
            }
            placeholder={t.correctionNotePlaceholder}
            rows={3}
            maxLength={500}
          />
          {dialog.error ? (
            <Alert variant="destructive">
              <AlertDescription>{dialog.error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => controller.setDialogs((state) => ({ ...state, correction: { ...state.correction, open: false } }))}
          >
            {t.cancel}
          </Button>
          <Button onClick={() => void controller.correctEntry()} disabled={dialog.submitting}>
            {dialog.submitting ? t.correctionSubmitting : t.correctionSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DonationDialog({ controller }: { controller: OrgController }) {
  const { t, dialogs } = controller;
  const dialog = dialogs.donation;
  return (
    <Dialog
      open={dialog.open}
      onOpenChange={(open) => {
        if (!open) controller.setDialogs((state) => ({ ...state, donation: { ...state.donation, open: false } }));
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialog.mode === "receive" ? t.donorConfirmDialogTitle : t.donorNotReceivedConfirm}</DialogTitle>
          <DialogDescription>{t.donorConfirmDialogDescription}</DialogDescription>
        </DialogHeader>
        {dialog.mode === "receive" ? (
          <div className="space-y-2">
            <Label htmlFor="donationQty">{t.donorQtyLabel}</Label>
            <Input
              id="donationQty"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={dialog.qty}
              onChange={(event) =>
                controller.setDialogs((state) => ({ ...state, donation: { ...state.donation, qty: event.target.value } }))
              }
            />
            <p className="text-xs text-muted-foreground">{t.donorQtyHint}</p>
          </div>
        ) : null}
        {dialog.error ? (
          <Alert className="mt-4" variant="destructive">
            <AlertDescription>{dialog.error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => controller.setDialogs((state) => ({ ...state, donation: { ...state.donation, open: false } }))}
          >
            {t.cancel}
          </Button>
          <Button onClick={() => void controller.confirmDonation()} disabled={dialog.submitting}>
            {dialog.submitting
              ? dialog.mode === "receive"
                ? t.donorConfirmSubmitting
                : t.donorNotReceivedSubmitting
              : dialog.mode === "receive"
                ? t.donorConfirmSubmit
                : t.donorNotReceivedConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({ controller }: { controller: OrgController }) {
  const { t, dialogs } = controller;
  const dialog = dialogs.remove;
  return (
    <Dialog
      open={dialog.open}
      onOpenChange={(open) => {
        if (!open) controller.setDialogs((state) => ({ ...state, remove: { ...state.remove, open: false } }));
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.staffRemoveConfirmTitle}</DialogTitle>
          <DialogDescription>
            {dialog.member ? fillTemplate(t.staffRemoveConfirmBody, { email: dialog.member.email }) : ""}
          </DialogDescription>
        </DialogHeader>
        {dialog.error ? (
          <Alert variant="destructive">
            <AlertDescription>{dialog.error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => controller.setDialogs((state) => ({ ...state, remove: { ...state.remove, open: false } }))}
          >
            {t.staffRemoveCancel}
          </Button>
          <Button variant="destructive" onClick={() => void controller.removeMember()} disabled={dialog.submitting}>
            {dialog.submitting ? t.staffRemoving : t.staffRemoveConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QrDialog({ controller }: { controller: OrgController }) {
  const { t, qrCenter } = controller;
  const url = qrCenter && typeof window !== "undefined" ? `${window.location.origin}/drop-centers/${qrCenter.id}?drop=1` : "";
  return (
    <Dialog
      open={Boolean(qrCenter)}
      onOpenChange={(open) => {
        if (!open) controller.closeQr();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.printQrTitle}</DialogTitle>
          <DialogDescription>{t.printQrInstruction}</DialogDescription>
        </DialogHeader>
        {controller.qrLoading ? (
          <p role="status">{t.loadingShort}</p>
        ) : controller.qrDataUrl ? (
          <img src={controller.qrDataUrl} alt={t.qrAlt} width={240} height={240} className="mx-auto rounded-md border" />
        ) : null}
        <code className="break-all font-mono text-xs">{url}</code>
        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()}>
            {t.printButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
