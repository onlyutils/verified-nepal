import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";
import type { DeskModel } from "./use-desk";
import type { OrgStatus } from "@/lib/api";

function statusLabel(model: DeskModel, status: OrgStatus) {
  return model.ds[`orgsStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`] ?? status;
}
function orgTypeLabel(model: DeskModel, type: string) {
  return model.dos[`orgType_${type}`] ?? type;
}

function OrgActions({ model, status, id }: { model: DeskModel; status: OrgStatus; id: string }) {
  if (status === "pending")
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            model.setOrgVerifyId(id);
            model.setOrgVerifyTier("known");
            model.setOrgVerifyNote("");
            model.setOrgVerifyError(null);
          }}
        >
          {model.dos.orgVerify}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            model.setOrgRejectId(id);
            model.setOrgRejectReason("");
            model.setOrgRejectError(null);
          }}
        >
          {model.dos.orgReject}
        </Button>
      </div>
    );
  if (status === "verified")
    return (
      <Button
        size="sm"
        variant="destructive"
        onClick={() => {
          model.setOrgSuspendId(id);
          model.setOrgSuspendReason("");
          model.setOrgSuspendError(null);
        }}
      >
        {model.dos.orgSuspend}
      </Button>
    );
  if (status === "suspended")
    return (
      <Button size="sm" onClick={() => model.handleOrg(id, { action: "reinstate" })}>
        {model.dos.orgReinstate}
      </Button>
    );
  return null;
}

function OrgCard({ model, org }: { model: DeskModel; org: DeskModel["orgs"][number] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>{org.name}</CardTitle>
          <StatusBadge tone={toneForStatus(org.status)}>{statusLabel(model, org.status)}</StatusBadge>
        </div>
        <CardDescription>
          {orgTypeLabel(model, org.orgType)} · {org.registrationNumber || model.t.unavailable} ·{" "}
          {new Date(org.createdAt).toLocaleDateString()} · {model.dos.orgCentersCount.replace("{count}", String(org.centersCount))}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <strong>{model.dos.orgContactNameLabel}:</strong> {org.contactName}
          </p>
          <p>
            <strong>{model.dos.orgContactPhoneLabel}:</strong>{" "}
            <a className="underline" href={`tel:${org.contactPhone}`}>
              {org.contactPhone}
            </a>
          </p>
          {org.contactEmail ? (
            <p>
              <strong>{model.dos.orgContactEmailLabel}:</strong> {org.contactEmail}
            </p>
          ) : null}
          {org.ownerEmail ? (
            <p>
              <strong>{model.dos.orgOwnerEmailLabel}:</strong> {org.ownerEmail}
            </p>
          ) : null}
          <p>
            <strong>{model.dos.orgDistrictsLabel}:</strong> {org.districts.join(", ")}
          </p>
          {org.website ? (
            <p className="break-words">
              <strong>{model.dos.orgWebsiteLabel}:</strong>{" "}
              <a className="underline" href={org.website} target="_blank" rel="noreferrer">
                {org.website}
              </a>
            </p>
          ) : null}
        </div>
        <p className="rounded-lg border bg-secondary p-4 text-sm leading-6">{org.description}</p>
        {org.vouches?.length ? (
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{model.dos.orgVouchesLabel}</p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {org.vouches.map((vouch) => (
                <li key={vouch.orgId}>
                  {model.dos.orgVouchFrom.replace("{name}", vouch.orgName)} · {new Date(vouch.at).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {org.status === "verified" && org.tier ? (
          <div className="rounded-lg border bg-primary-soft p-4">
            <p className="text-xs font-semibold text-primary">{model.dos.orgTierLabel}</p>
            <p className="mt-1 text-sm font-semibold">
              {org.tier === "known"
                ? model.dos.orgTierKnownShort
                : org.tier === "vouched"
                  ? model.dos.orgTierVouchedShort
                  : model.dos.orgTierSelfDeclaredShort}
            </p>
            {org.verificationNote ? <p className="mt-1 text-sm">{org.verificationNote}</p> : null}
          </div>
        ) : null}
        {org.status === "rejected" && org.rejectionReason ? (
          <p className="text-sm">
            <strong>{model.dos.orgRejectionReasonLabel}:</strong> {org.rejectionReason}
          </p>
        ) : null}
        {org.status === "suspended" && org.suspensionReason ? (
          <p className="text-sm">
            <strong>{model.dos.orgSuspensionReasonLabel}:</strong> {org.suspensionReason}
          </p>
        ) : null}
        <OrgActions model={model} status={org.status} id={org.id} />
      </CardContent>
    </Card>
  );
}

export function Organizations({ model }: { model: DeskModel }) {
  return (
    <SectionFrame title={model.dos.orgsTitle} description={model.ds.deskOrgsDescription} refresh={() => model.loadOrgs(model.orgsStatus)}>
      <Tabs value={model.orgsStatus} onValueChange={(value) => model.setOrgsStatus(value as OrgStatus)}>
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="pending">{model.dos.orgsStatusPending}</TabsTrigger>
          <TabsTrigger value="verified">{model.dos.orgsStatusVerified}</TabsTrigger>
          <TabsTrigger value="rejected">{model.dos.orgsStatusRejected}</TabsTrigger>
          <TabsTrigger value="suspended">{model.dos.orgsStatusSuspended}</TabsTrigger>
        </TabsList>
      </Tabs>
      {model.orgsLoading ? (
        <SectionLoading label={model.dos.orgsLoading} />
      ) : model.orgsError ? (
        <SectionError message={model.orgsError} retry={() => model.loadOrgs(model.orgsStatus)} />
      ) : !model.orgs.length ? (
        <SectionEmpty icon={Building2} title={model.dos.orgsEmpty} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border bg-background md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{model.ds.deskOrganization}</TableHead>
                  <TableHead>{model.ds.deskTableStatus}</TableHead>
                  <TableHead>{model.ds.deskTableLocation}</TableHead>
                  <TableHead>{model.ds.deskOrganizationCreated}</TableHead>
                  <TableHead>{model.ds.deskOrganizationActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.orgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <p className="font-semibold">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{orgTypeLabel(model, org.orgType)}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={toneForStatus(org.status)}>{statusLabel(model, org.status)}</StatusBadge>
                    </TableCell>
                    <TableCell>{org.districts.join(", ")}</TableCell>
                    <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <OrgActions model={model} status={org.status} id={org.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-4 md:hidden">
            {model.orgs.map((org) => (
              <OrgCard key={org.id} model={model} org={org} />
            ))}
          </div>
        </>
      )}
    </SectionFrame>
  );
}
