import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { DeskModel } from "./use-desk";

function ReasonFields({
  model,
  id,
  code,
  setCode,
  detail,
  setDetail,
  error,
}: {
  model: DeskModel;
  id: string;
  code: string;
  setCode: (value: string) => void;
  detail: string;
  setDetail: (value: string) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${id}-code`}>{model.ds.rejectReasonCodeLabel} *</Label>
        <NativeSelect id={`${id}-code`} value={code} onChange={(event) => setCode(event.target.value)}>
          <NativeSelectOption value="">{model.ds.rejectReasonCodePlaceholder}</NativeSelectOption>
          {["not_consented", "duplicate", "unreachable", "out_of_scope", "insufficient_detail", "other"].map((reason) => (
            <NativeSelectOption key={reason} value={reason}>
              {model.ds[`rejectCode_${reason}`]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-detail`}>{model.ds.rejectReasonDetailLabel}</Label>
        <Textarea
          id={`${id}-detail`}
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          placeholder={model.ds.rejectReasonDetailPlaceholder}
          rows={3}
        />
      </div>
      <p className="text-sm text-muted-foreground">{model.ds.rejectReasonHelper}</p>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function DeskDialogs({ model }: { model: DeskModel }) {
  const needName =
    model.publishedNeeds.find((need) => need.id === model.archiveId || need.id === model.fulfillId)?.maskedName || model.t.deskBoardsTitle;
  return (
    <>
      <Dialog
        open={!!model.rejectId}
        onOpenChange={(open) => {
          if (!open) {
            model.setRejectId(null);
            model.setRejectError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{model.t.deskRejectReasonTitle}</DialogTitle>
            <DialogDescription>{model.ds.rejectDialogDescription}</DialogDescription>
          </DialogHeader>
          <ReasonFields
            model={model}
            id="need-reject"
            code={model.rejectCode}
            setCode={model.setRejectCode}
            detail={model.rejectDetail}
            setDetail={model.setRejectDetail}
            error={model.rejectError}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => model.setRejectId(null)}>
              {model.t.deskCancel}
            </Button>
            <Button variant="destructive" onClick={model.handleReject}>
              {model.t.deskRejectConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!model.projectRejectId}
        onOpenChange={(open) => {
          if (!open) {
            model.setProjectRejectId(null);
            model.setProjectRejectError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{model.t.deskProjectsRejectReason}</DialogTitle>
            <DialogDescription>{model.ds.rejectDialogDescription}</DialogDescription>
          </DialogHeader>
          <ReasonFields
            model={model}
            id="project-reject"
            code={model.projectRejectCode}
            setCode={model.setProjectRejectCode}
            detail={model.projectRejectDetail}
            setDetail={model.setProjectRejectDetail}
            error={model.projectRejectError}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => model.setProjectRejectId(null)}>
              {model.t.deskCancel}
            </Button>
            <Button variant="destructive" onClick={model.handleProjectReject}>
              {model.t.deskProjectsReject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!model.dispatchRejectId}
        onOpenChange={(open) => {
          if (!open) {
            model.setDispatchRejectId(null);
            model.setDispatchRejectError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{model.t.deskDispatchesRejectTitle}</DialogTitle>
            <DialogDescription>{model.ds.rejectDialogDescription}</DialogDescription>
          </DialogHeader>
          <ReasonFields
            model={model}
            id="dispatch-reject"
            code={model.dispatchRejectCode}
            setCode={model.setDispatchRejectCode}
            detail={model.dispatchRejectDetail}
            setDetail={model.setDispatchRejectDetail}
            error={model.dispatchRejectError}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => model.setDispatchRejectId(null)}>
              {model.t.deskCancel}
            </Button>
            <Button variant="destructive" onClick={model.handleDispatchReject}>
              {model.t.deskDispatchesRejectConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!model.archiveId}
        onOpenChange={(open) => {
          if (!open) model.setArchiveId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{model.ds.archiveConfirmTitle}</DialogTitle>
            <DialogDescription>{model.ds.archiveConfirmBody.replace("{name}", needName)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => model.setArchiveId(null)}>
              {model.t.deskCancel}
            </Button>
            <Button variant="destructive" onClick={() => model.archiveId && model.handleNeedStatus(model.archiveId, "archived")}>
              {model.t.deskArchive}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!model.fulfillId}
        onOpenChange={(open) => {
          if (!open) model.setFulfillId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{model.ds.fulfillConfirmTitle}</DialogTitle>
            <DialogDescription>{model.ds.fulfillConfirmBody.replace("{name}", needName)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => model.setFulfillId(null)}>
              {model.t.deskCancel}
            </Button>
            <Button onClick={() => model.fulfillId && model.handleNeedStatus(model.fulfillId, "fulfilled")}>{model.t.deskFulfill}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!model.redeemCode}
        onOpenChange={(open) => {
          if (!open) {
            model.setRedeemCode(null);
            model.setRedeemNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{model.t.deskRedeemConfirmTitle}</DialogTitle>
            <DialogDescription>
              {model.redeemCode ? model.t.deskRedeemConfirmBody.replace("{code}", model.redeemCode) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="break-all rounded-lg border bg-success-soft p-4 font-mono text-xl font-bold tracking-widest text-success">
              {model.redeemCode}
            </p>
            <div className="space-y-2">
              <Label htmlFor="redeem-note">{model.ds.redeemNoteLabel}</Label>
              <Input
                id="redeem-note"
                value={model.redeemNote}
                onChange={(event) => model.setRedeemNote(event.target.value)}
                placeholder={model.ds.redeemNotePlaceholder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => model.setRedeemCode(null)}>
              {model.t.deskCancel}
            </Button>
            <Button onClick={model.handleRedeem}>{model.t.deskRedeem}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!model.verifyProjectId}
        onOpenChange={(open) => {
          if (!open) model.setVerifyProjectId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{model.t.deskProjectsVerify}</DialogTitle>
            <DialogDescription>
              {model.verifyProjectId
                ? (() => {
                    const project = model.projects.find((item) => item.id === model.verifyProjectId);
                    return project
                      ? model.t.deskProjectsVerifyConfirm
                          .replace("{contactName}", project.committee.contactName)
                          .replace("{phone}", project.committee.phone)
                      : "";
                  })()
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => model.setVerifyProjectId(null)}>
              {model.t.deskCancel}
            </Button>
            <Button
              onClick={() => {
                const id = model.verifyProjectId;
                if (id) model.handleProject(id, { action: "verify-committee" });
              }}
            >
              {model.t.deskProjectsVerify}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!model.orgVerifyId}
        onOpenChange={(open) => {
          if (!open) {
            model.setOrgVerifyId(null);
            model.setOrgVerifyError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{model.dos.orgVerifyTitle}</DialogTitle>
            <DialogDescription>{model.dos.orgVerifyDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="org-tier">{model.dos.orgTierSelectLabel}</Label>
              <NativeSelect
                id="org-tier"
                value={model.orgVerifyTier}
                onChange={(event) => model.setOrgVerifyTier(event.target.value as "known" | "vouched" | "self_declared")}
              >
                <NativeSelectOption value="known">{model.dos.orgTierKnown}</NativeSelectOption>
                <NativeSelectOption value="vouched">{model.dos.orgTierVouched}</NativeSelectOption>
                <NativeSelectOption value="self_declared">{model.dos.orgTierSelfDeclared}</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-note">{model.dos.orgNoteLabel}</Label>
              <Textarea
                id="org-note"
                value={model.orgVerifyNote}
                onChange={(event) => model.setOrgVerifyNote(event.target.value)}
                placeholder={model.dos.orgNotePlaceholder}
                rows={3}
              />
            </div>
            {model.orgVerifyError ? (
              <Alert variant="destructive">
                <AlertDescription>{model.orgVerifyError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => model.setOrgVerifyId(null)}>
              {model.t.deskCancel}
            </Button>
            <Button
              onClick={() => {
                if (!model.orgVerifyId) return;
                if (model.orgVerifyNote.trim().length < 5) model.setOrgVerifyError(model.dos.orgNoteRequired);
                else
                  void model.handleOrg(model.orgVerifyId, {
                    action: "verify",
                    tier: model.orgVerifyTier,
                    note: model.orgVerifyNote.trim(),
                  });
              }}
            >
              {model.dos.orgVerify}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!model.orgRejectId}
        onOpenChange={(open) => {
          if (!open) {
            model.setOrgRejectId(null);
            model.setOrgRejectError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{model.dos.orgRejectTitle}</DialogTitle>
            <DialogDescription>{model.dos.orgRejectDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="org-reject-reason">{model.dos.orgRejectLabel}</Label>
            <Textarea
              id="org-reject-reason"
              value={model.orgRejectReason}
              onChange={(event) => model.setOrgRejectReason(event.target.value)}
              placeholder={model.dos.orgRejectPlaceholder}
              rows={3}
            />
            {model.orgRejectError ? (
              <Alert variant="destructive">
                <AlertDescription>{model.orgRejectError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => model.setOrgRejectId(null)}>
              {model.t.deskCancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!model.orgRejectId) return;
                if (model.orgRejectReason.trim().length < 5) model.setOrgRejectError(model.dos.orgReasonRequired);
                else void model.handleOrg(model.orgRejectId, { action: "reject", reason: model.orgRejectReason.trim() });
              }}
            >
              {model.dos.orgReject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!model.orgSuspendId}
        onOpenChange={(open) => {
          if (!open) {
            model.setOrgSuspendId(null);
            model.setOrgSuspendError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{model.dos.orgSuspendTitle}</DialogTitle>
            <DialogDescription>{model.dos.orgSuspendDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="org-suspend-reason">{model.dos.orgSuspendLabel}</Label>
            <Textarea
              id="org-suspend-reason"
              value={model.orgSuspendReason}
              onChange={(event) => model.setOrgSuspendReason(event.target.value)}
              placeholder={model.dos.orgSuspendPlaceholder}
              rows={3}
            />
            {model.orgSuspendError ? (
              <Alert variant="destructive">
                <AlertDescription>{model.orgSuspendError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => model.setOrgSuspendId(null)}>
              {model.t.deskCancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!model.orgSuspendId) return;
                if (model.orgSuspendReason.trim().length < 5) model.setOrgSuspendError(model.dos.orgReasonRequired);
                else void model.handleOrg(model.orgSuspendId, { action: "suspend", reason: model.orgSuspendReason.trim() });
              }}
            >
              {model.dos.orgSuspend}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={model.adminConfirmOpen} onOpenChange={model.setAdminConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{model.t.deskAdminConfirmTitle}</DialogTitle>
            <DialogDescription>
              {model.adminLookupUser
                ? model.ds.deskAdminRoleChangeBody
                    .replace("{email}", model.adminLookupUser.email)
                    .replace("{role}", model.adminRole)
                    .replace(
                      "{districts}",
                      Object.keys(model.adminDistricts)
                        .filter((key) => model.adminDistricts[key])
                        .join(", ") || model.t.deskScopeAll,
                    )
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => model.setAdminConfirmOpen(false)}>
              {model.t.deskCancel}
            </Button>
            <Button onClick={model.handleAdminSave}>{model.t.deskAdminSave}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
