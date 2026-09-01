import type { Language, Page } from "../types";
import { centerStrings } from "../i18n-centers";

// Stub — implemented in plan task P3-F.
export function DonationStatusPage({ language, refCode }: { language: Language; navigate: (page: Page) => void; refCode: string }) {
  return <h1 className="font-serif text-3xl">{centerStrings[language].donationStatusTitle} · {refCode}</h1>;
}
