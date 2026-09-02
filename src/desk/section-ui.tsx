import { RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function SectionFrame({
  title,
  description,
  refresh,
  refreshLabel,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  refresh: () => void;
  refreshLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        as="h2"
        title={title}
        description={description}
        actions={
          <Button variant="outline" onClick={refresh}>
            <RefreshCw aria-hidden="true" />
            {refreshLabel ?? title}
          </Button>
        }
      />
      {children}
    </div>
  );
}

export function SectionError({ message, retry, retryLabel }: { message: string; retry: () => void; retryLabel?: string }) {
  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button variant="outline" onClick={retry}>
        {retryLabel ?? message}
      </Button>
    </div>
  );
}

export function SectionLoading({ label }: { label: string }) {
  return <LoadingState label={label} />;
}
export function SectionEmpty({ title, description, icon }: { title: ReactNode; description?: ReactNode; icon?: LucideIcon }) {
  return <EmptyState icon={icon} title={title} description={description} />;
}
