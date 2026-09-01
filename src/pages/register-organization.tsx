import type { Language, Page } from "../types";
import { orgStrings } from "../i18n-orgs";

// Stub — implemented in plan task P1-FA.
export function RegisterOrganization({ language }: { language: Language; navigate: (page: Page) => void }) {
  return <h1 className="font-serif text-3xl">{orgStrings[language].registerOrgTitle}</h1>;
}
