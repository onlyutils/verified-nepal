import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { labels } from "@/i18n";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function BackToTop({ language }: { language: Language }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const remaining = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      setVisible(window.scrollY > window.innerHeight && remaining < window.innerHeight);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!visible) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="fixed bottom-6 left-4 z-40 bg-background sm:left-6"
      aria-label={labels[language].backToTop}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUp aria-hidden="true" />
    </Button>
  );
}
