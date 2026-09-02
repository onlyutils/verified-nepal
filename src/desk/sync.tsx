import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionFrame } from "./section-ui";
import type { DeskModel } from "./use-desk";

export function Sync({ model }: { model: DeskModel }) {
  return (
    <SectionFrame
      title={model.t.deskSyncTitle}
      description={model.ds.deskSyncDescription}
      refresh={() => model.setSyncText("")}
      refreshLabel={model.ds.deskRefresh}
    >
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="sync-codes">{model.t.deskSyncTitle}</Label>
            <Textarea
              id="sync-codes"
              value={model.syncText}
              onChange={(event) => model.setSyncText(event.target.value)}
              placeholder={model.t.deskSyncPlaceholder}
              rows={8}
              className="font-mono"
            />
          </div>
          {model.syncError ? (
            <Alert variant="destructive">
              <AlertDescription>{model.syncError}</AlertDescription>
            </Alert>
          ) : null}
          <Button onClick={model.handleSync} disabled={model.syncLoading}>
            {model.syncLoading ? model.t.deskSyncSubmitting : model.t.deskSyncSubmit}
          </Button>
          {model.syncResults ? (
            <div className="space-y-3" role="status">
              <h3 className="text-base font-semibold">{model.ds.syncResultsTitle}</h3>
              <ul className="divide-y rounded-lg border">
                {model.syncResults.map((result) => (
                  <li key={result.code} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span className="font-mono tracking-widest">{result.code}</span>
                    <Badge variant={result.status === "redeemed" ? "success" : result.status === "already_redeemed" ? "warning" : "danger"}>
                      {result.status === "redeemed"
                        ? model.t.deskSyncResultRedeemed
                        : result.status === "already_redeemed"
                          ? model.t.deskSyncResultAlready
                          : model.t.deskSyncResultUnknown}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </SectionFrame>
  );
}
