import { UserPlus, Users } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { statusTone } from "./use-org";
import type { OrgController } from "./org-types";

export function Team({ controller }: { controller: OrgController }) {
  const { t, language } = controller;
  if (!controller.isOwner)
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <PageHeader eyebrow={t.navTeam} title={t.staffTitle} description={t.teamDescription} />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{t.unauthorizedEdit}</CardContent>
        </Card>
      </div>
    );
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader eyebrow={t.navTeam} title={t.staffTitle} description={t.teamDescription} />
      <Card>
        <CardHeader>
          <CardTitle>{t.staffTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {controller.membersLoading ? (
            <LoadingState label={t.staffLoading} />
          ) : controller.membersError ? (
            <p className="text-sm text-destructive" role="alert">
              {controller.membersError}
            </p>
          ) : !controller.members.length ? (
            <EmptyState icon={Users} title={t.staffEmpty} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.staffNameLabel}</TableHead>
                  <TableHead>{t.staffEmailLabel}</TableHead>
                  <TableHead>{t.staffRoleLabel}</TableHead>
                  <TableHead>{t.staffStatusLabel}</TableHead>
                  <TableHead>{t.staffDateLabel}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {controller.members.map((member) => (
                  <TableRow key={member.email}>
                    <TableCell>{member.name ?? t.notAvailable}</TableCell>
                    <TableCell className="font-mono text-sm">{member.email}</TableCell>
                    <TableCell>{member.role === "owner" ? t.staffRoleOwner : t.staffRoleStaff}</TableCell>
                    <TableCell>
                      <StatusBadge tone={statusTone(member.status === "member" ? "active" : "pending")}>
                        {member.status === "member" ? t.staffStatusMember : t.staffStatusInvited}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatDateTime(member.createdAt, language)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          controller.setDialogs((state) => ({ ...state, remove: { open: true, member, error: null, submitting: false } }))
                        }
                      >
                        {t.staffRemove}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.staffInviteSubmit}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => void controller.inviteMember(event)}
            noValidate
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="inviteEmail">{t.staffInviteLabel}</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={controller.inviteEmail}
                onChange={(event) => controller.setInviteEmail(event.target.value)}
                placeholder={t.staffInvitePlaceholder}
                required
              />
            </div>
            <Button type="submit" disabled={controller.inviteSubmitting}>
              <UserPlus />
              {controller.inviteSubmitting ? t.staffInviteSubmitting : t.staffInviteSubmit}
            </Button>
          </form>
          {controller.inviteError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {controller.inviteError}
            </p>
          ) : null}
          {controller.inviteMsg ? (
            <p className="mt-3 text-sm text-success" role="status">
              {controller.inviteMsg}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
