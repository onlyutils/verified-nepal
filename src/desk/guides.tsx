import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Language } from "@/lib/types";
import { renderGuidelinesMarkdown } from "./gates";
import { navStrings } from "@/i18n/nav";
import governanceRaw from "../../docs/GOVERNANCE.md?raw";
import moderationRaw from "../../docs/MODERATION-GUIDELINES.md?raw";

export function Guides({ language }: { language: Language }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{navStrings[language].governance}</CardTitle>
        </CardHeader>
        <CardContent>
          <article className="text-sm">{renderGuidelinesMarkdown(governanceRaw)}</article>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{navStrings[language].moderationGuidelines}</CardTitle>
        </CardHeader>
        <CardContent>
          <article className="text-sm">{renderGuidelinesMarkdown(moderationRaw)}</article>
        </CardContent>
      </Card>
    </div>
  );
}
