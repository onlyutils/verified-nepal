import type { ReactNode } from "react";
import { LogOut, Phone, UserRound } from "lucide-react";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Language } from "@/lib/types";

export interface AppShellNavItem<K extends string = string> {
  key: K;
  label: string;
  /** Unfiltered count shown after the label (queue size, pending items). */
  count?: number;
  icon?: ReactNode;
}

/**
 * Shell for signed-in work surfaces (the Desk, My organization).
 * Top bar: logo · title · emergency 1234 · language · account menu.
 * Below lg the nav is a horizontally scrolling tab strip; from lg it is a sticky left sidebar.
 * Public pages do not use this — they use the site header/footer in layout.tsx.
 */
export function AppShell<K extends string>({
  title,
  nav,
  active,
  onSelect,
  user,
  onProfile,
  profileLabel,
  onSignOut,
  signOutLabel,
  language,
  setLanguage,
  onHome,
  aside,
  children,
}: {
  title: string;
  nav: AppShellNavItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  user?: { name?: string | null; email?: string | null } | null;
  onProfile?: () => void;
  profileLabel?: string;
  onSignOut?: () => void;
  signOutLabel: string;
  language: Language;
  setLanguage: (language: Language) => void;
  onHome: () => void;
  /** Small element under the title, e.g. a scope badge. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={onHome}
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo language={language} />
          </button>
          <span aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
          <span className="hidden text-sm font-semibold text-muted-foreground sm:block">{title}</span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="text-destructive">
              <a href="tel:1234">
                <Phone />
                1234
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === "en" ? "ne" : "en")}
              aria-label={language === "en" ? "नेपालीमा हेर्नुहोस्" : "Switch to English"}
            >
              <span lang={language === "en" ? "ne" : "en"}>{language === "en" ? "नेपाली" : "EN"}</span>
            </Button>
            <AccessibilityBar language={language} />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="max-w-[10rem]">
                    <span
                      className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold uppercase text-primary-foreground"
                      aria-hidden="true"
                    >
                      {(user.name || user.email || "?").slice(0, 1)}
                    </span>
                    <span className="hidden truncate sm:inline">{user.name || user.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <span className="block truncate text-sm font-semibold">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {onProfile ? (
                    <DropdownMenuItem onSelect={onProfile}>
                      <UserRound />
                      {profileLabel}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onSelect={onSignOut}>
                    <LogOut />
                    {signOutLabel}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col lg:flex-row">
        <nav
          aria-label={title}
          className="border-b bg-background lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r"
        >
          <div className="hidden px-5 pb-1 pt-5 lg:block">
            <p className="text-base font-bold text-foreground">{title}</p>
            {aside ? <div className="mt-2">{aside}</div> : null}
          </div>
          <ul className="flex overflow-x-auto px-2 lg:flex-col lg:gap-0.5 lg:px-3 lg:py-3">
            {nav.map((item) => {
              const isActive = item.key === active;
              return (
                <li key={item.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelect(item.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex min-h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isActive ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {item.icon ? (
                      <span className="[&_svg]:size-4" aria-hidden="true">
                        {item.icon}
                      </span>
                    ) : null}
                    <span>{item.label}</span>
                    {item.count ? (
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${isActive ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"}`}
                      >
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {aside ? <div className="px-4 pb-3 lg:hidden">{aside}</div> : null}
        </nav>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 focus:outline-none sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
