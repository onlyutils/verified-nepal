import type { Language, Page } from "../types";
import { centerStrings } from "../i18n-centers";

// Stub — implemented in plan task P1-FB.
export function DropCenters({ language }: { language: Language; navigate: (page: Page) => void }) {
  return <h1 className="font-serif text-3xl">{centerStrings[language].dropCentersTitle}</h1>;
}
