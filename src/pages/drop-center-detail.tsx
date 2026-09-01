import type { Language, Page } from "../types";
import { centerStrings } from "../i18n-centers";

// Stub — implemented in plan task P1-FB.
export function DropCenterDetail({ language, id }: { language: Language; navigate: (page: Page) => void; id: string }) {
  return <h1 className="font-serif text-3xl">{centerStrings[language].dropCentersTitle} · {id}</h1>;
}
