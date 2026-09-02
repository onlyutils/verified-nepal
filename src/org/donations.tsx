import { useEffect } from "react";
import { PackageCheck } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatNumber } from "@/lib/format";
import { goodsLabel, unitLabel } from "@/lib/goods";
import { statusTone } from "./use-org";
import type { OrgController } from "./org-types";

export function Donations({ controller }: { controller: OrgController }) {
  const { centers } = controller;
  useEffect(() => {
    centers.forEach((center) => {
      if (controller.donationsById[center.id] === undefined && !controller.donationsLoadingById[center.id])
        void controller.fetchDonations(center.id);
    });
  }, [centers, controller.donationsById, controller.donationsLoadingById, controller]);
  const donations = centers.flatMap((center) => controller.donationsById[center.id] ?? []);
  const loading = centers.some((center) => controller.donationsLoadingById[center.id]);
  const error = centers.map((center) => controller.donationsErrorById[center.id]).find(Boolean);
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow={controller.t.navDonations}
        title={controller.t.donorDropsTitle}
        description={controller.t.donationsDescription}
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {loading && !donations.length ? (
        <LoadingState label={controller.t.donorLoading} />
      ) : !centers.length ? (
        <EmptyState icon={PackageCheck} title={controller.t.donationsNoCenter} />
      ) : !donations.length ? (
        <EmptyState icon={PackageCheck} title={controller.t.donorDropsEmpty} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden md:block">
              <DonationTable controller={controller} />
            </div>
            <div className="divide-y md:hidden">
              {donations.map((donation) => (
                <DonationRow key={donation.ref} donation={donation} controller={controller} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DonationTable({ controller }: { controller: OrgController }) {
  const donations = controller.centers.flatMap((center) => controller.donationsById[center.id] ?? []);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{controller.t.donationsRef}</TableHead>
          <TableHead>{controller.t.donorDropsCategory}</TableHead>
          <TableHead>{controller.t.donorDropsQty}</TableHead>
          <TableHead>{controller.t.donationsCenter}</TableHead>
          <TableHead>{controller.t.donorDropsDate}</TableHead>
          <TableHead>{controller.t.donationsStatus}</TableHead>
          <TableHead>{controller.t.donationsActions}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {donations.map((donation) => (
          <TableRow key={donation.ref}>
            <TableCell>
              <code className="font-mono text-sm">{donation.ref}</code>
            </TableCell>
            <TableCell>{goodsLabel(donation.category, controller.language)}</TableCell>
            <TableCell className="tabular-nums">
              {formatNumber(donation.qty, controller.language)} {unitLabel(donation.unit, controller.language)}
            </TableCell>
            <TableCell>{donation.center.name}</TableCell>
            <TableCell className="whitespace-nowrap text-xs">{formatDateTime(donation.declaredAt, controller.language)}</TableCell>
            <TableCell>
              <StatusBadge tone={statusTone(donation.status)}>{controller.t.donationDeclared}</StatusBadge>
            </TableCell>
            <TableCell>
              <DonationActions donation={donation} controller={controller} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DonationRow({ donation, controller }: { donation: import("@/lib/api").DonationStatus; controller: OrgController }) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <code className="font-mono text-sm">{donation.ref}</code>
        <StatusBadge tone={statusTone(donation.status)}>{controller.t.donationDeclared}</StatusBadge>
      </div>
      <p className="font-medium">
        {goodsLabel(donation.category, controller.language)} · {formatNumber(donation.qty, controller.language)}{" "}
        {unitLabel(donation.unit, controller.language)}
      </p>
      <p className="text-sm text-muted-foreground">
        {donation.center.name} · {formatDateTime(donation.declaredAt, controller.language)}
      </p>
      <DonationActions donation={donation} controller={controller} />
    </div>
  );
}

function DonationActions({ donation, controller }: { donation: import("@/lib/api").DonationStatus; controller: OrgController }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() =>
          controller.setDialogs((state) => ({
            ...state,
            donation: {
              open: true,
              ref: donation.ref,
              centerId: donation.center.id,
              qty: String(donation.qty),
              error: null,
              submitting: false,
              mode: "receive",
            },
          }))
        }
      >
        {controller.t.donorConfirmReceived}
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          controller.setDialogs((state) => ({
            ...state,
            donation: {
              open: true,
              ref: donation.ref,
              centerId: donation.center.id,
              qty: "",
              error: null,
              submitting: false,
              mode: "not_received",
            },
          }))
        }
      >
        {controller.t.donorNotReceived}
      </Button>
    </div>
  );
}
