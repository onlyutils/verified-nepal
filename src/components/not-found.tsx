import { shellStrings } from "@/i18n/shell";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function NotFound({ language, onBack }: { language: Language; onBack: () => void }) {
  const t = shellStrings[language];

  return (
    <section className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-start justify-center gap-4">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t.notFoundTitle}</h1>
      <p className="text-base text-muted-foreground">{t.notFoundBody}</p>
      <Button type="button" onClick={onBack}>
        {t.backToFrontPage}
      </Button>
    </section>
  );
}
