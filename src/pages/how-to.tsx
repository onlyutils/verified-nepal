import { useEffect, useRef, useState } from "react";
import { ArrowUp, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { howToStrings, type HowToCopyKey } from "@/i18n/how-to";
import { getHowToSections, type HowToCard, type HowToDefinition, type HowToFigure, type HowToSection } from "@/content/how-to";
import type { Language } from "@/lib/types";

const TEST_GUIDE_ENABLED = import.meta.env.VITE_ENABLE_TEST_LOGIN === "true";

function Figure({ item, label, closeLabel }: { item: HowToFigure; label: string; closeLabel: string }) {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const figureRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const imageSource = `/how-to/${item.name}.jpg`;

  const close = () => {
    setOpen(false);
    figureRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (hidden) return null;
  const mobile = item.name.includes("mobile") || item.name.includes("ne-");
  return (
    <figure
      ref={figureRef}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={label}
      className={`how-to-figure cursor-zoom-in overflow-hidden rounded-xl border bg-secondary/40 p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${mobile ? "max-w-[360px]" : "max-w-full"}`}
      onClick={() => setOpen(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      <img
        src={imageSource}
        alt={label}
        loading="lazy"
        decoding="async"
        className="block h-auto max-h-[34rem] w-full object-contain"
        onError={() => setHidden(true)}
      />
      <figcaption className="px-2 pb-1 pt-3 text-sm leading-6 text-muted-foreground">{label}</figcaption>
      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="relative flex max-h-[95vh] max-w-[95vw] flex-col items-center" onClick={(event) => event.stopPropagation()}>
            <button
              ref={closeButtonRef}
              type="button"
              className="absolute -right-2 -top-2 z-10 flex size-11 items-center justify-center rounded-full bg-background text-foreground shadow-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={closeLabel}
              onClick={close}
            >
              <X aria-hidden="true" className="size-5" />
            </button>
            <img src={imageSource} alt={label} className="max-h-[95vh] max-w-[95vw] object-contain" />
            <p className="mt-3 max-w-[95vw] text-center text-sm leading-6 text-white">{label}</p>
          </div>
        </div>
      ) : null}
    </figure>
  );
}

function Figures({ figures, strings }: { figures: readonly HowToFigure[]; strings: Record<HowToCopyKey, string> }) {
  if (!figures.length) return null;
  const hasMobileFigure = figures.some((item) => item.name.includes("mobile") || item.name.includes("ne-"));
  return (
    <div className={`mt-5 grid gap-4 ${hasMobileFigure ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
      {figures.map((item) => (
        <Figure key={item.name} item={item} label={strings[item.caption]} closeLabel={strings.closeFigure} />
      ))}
    </div>
  );
}

function Cards({ cards, strings }: { cards: readonly HowToCard[]; strings: Record<HowToCopyKey, string> }) {
  if (!cards.length) return null;
  return (
    <div className="mt-7 grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <article key={card.title} className={`rounded-xl border bg-secondary/20 p-5 ${card.title === "signInTitle" ? "sm:col-span-2" : ""}`}>
          <h3 className="text-lg font-bold text-foreground">{strings[card.title]}</h3>
          {card.title === "signInTitle" ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-background p-4">
                <h4 className="font-semibold text-foreground">{strings.signInRequired}</h4>
                <p className="mt-2 leading-7 text-muted-foreground">{strings.signInRequiredBody}</p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <h4 className="font-semibold text-foreground">{strings.signInNotRequired}</h4>
                <p className="mt-2 leading-7 text-muted-foreground">{strings.signInNotRequiredBody}</p>
              </div>
            </div>
          ) : (
            <p className="mt-2 leading-7">{strings[card.body]}</p>
          )}
          {card.figures ? <Figures figures={card.figures} strings={strings} /> : null}
        </article>
      ))}
    </div>
  );
}

function Definitions({ title, intro, definitions, strings }: { title?: HowToCopyKey; intro?: HowToCopyKey; definitions: readonly HowToDefinition[]; strings: Record<HowToCopyKey, string> }) {
  if (!definitions.length) return null;
  return (
    <div className="mt-7 rounded-xl border bg-secondary/20 p-5">
      {title ? <h3 className="text-lg font-bold text-foreground">{strings[title]}</h3> : null}
      {intro ? <p className="mt-2 leading-7">{strings[intro]}</p> : null}
      <dl className="mt-5 divide-y">
        {definitions.map((item) => (
          <div key={item.term} className="grid gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr] sm:gap-5">
            <dt className="font-semibold text-foreground">{strings[item.term]}</dt>
            <dd className="leading-7 text-muted-foreground">{strings[item.body]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DevCredentials({ strings }: { strings: Record<HowToCopyKey, string> }) {
  const rows = [
    [strings.tryAdmin, strings.tryAdminRole, strings.tryPasswordValue, strings.tryAdminShows],
    [strings.tryModerator, strings.tryModeratorRole, strings.tryPasswordValue, strings.tryModeratorShows],
    [strings.tryHelper, strings.tryHelperRole, strings.tryPasswordValue, strings.tryHelperShows],
    [strings.tryHelper01, strings.tryHelperRole, strings.tryPasswordValue, strings.tryHelper01Shows],
  ];
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-[44rem] w-full text-left text-sm">
        <thead className="bg-secondary text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">{strings.tryEmail}</th>
            <th scope="col" className="px-4 py-3">{strings.tryRole}</th>
            <th scope="col" className="px-4 py-3">{strings.tryPassword}</th>
            <th scope="col" className="px-4 py-3">{strings.tryShows}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(([email, role, password, shows]) => (
            <tr key={email} className="align-top">
              <td className="px-4 py-3 font-medium">{email}</td>
              <td className="px-4 py-3">{role}</td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{password}</td>
              <td className="px-4 py-3 leading-6">{shows}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VerificationPipeline({ strings }: { strings: Record<HowToCopyKey, string> }) {
  return (
    <div className="mt-6 rounded-xl border bg-secondary/40 p-4 sm:p-5">
      <h3 className="text-lg font-bold">{strings.oneRuleTitle}</h3>
      <ol className="mt-4 grid gap-2 sm:grid-cols-4">
        {[strings.pipelineSubmit, strings.pipelinePending, strings.pipelineDecision, strings.pipelineLive].map((label, index) => (
          <li key={label} className="relative rounded-lg border bg-background p-3 text-sm font-semibold leading-6">
            <span className="mr-2 text-primary">{index + 1}.</span>{label}
            {index < 3 ? <span className="hidden sm:block" aria-hidden="true">→</span> : null}
          </li>
        ))}
      </ol>
      <p className="mt-3 border-l-4 border-destructive/50 px-3 text-sm leading-6 text-muted-foreground">
        <span className="font-semibold text-foreground">{strings.pipelineReject}: </span>
        {strings.oneRuleBody}
      </p>
    </div>
  );
}

function Section({ section, strings, index }: { section: HowToSection; strings: Record<HowToCopyKey, string>; index: number }) {
  return (
    <section className="how-to-section border-t pt-10 first:border-t-0 first:pt-0">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">{String(index + 1).padStart(2, "0")}</p>
      <h2 id={section.id} className="mt-2 scroll-mt-24 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">{strings[section.title]}</h2>
      <p className="mt-3 text-lg leading-8 text-muted-foreground">{strings[section.summary]}</p>

      {section.devOnly ? (
        <div className="mt-6 space-y-5">
          <p className="leading-7">{strings.tryDevIntro}</p>
          <DevCredentials strings={strings} />
        </div>
      ) : (
        <>
          {section.paragraphs?.map((key) => (
            <p key={key} className="mt-5 leading-7">{strings[key]}</p>
          ))}
          {section.id === "what" ? <VerificationPipeline strings={strings} /> : null}
          {section.cards ? <Cards cards={section.cards} strings={strings} /> : null}
          {section.definitions ? <Definitions title={section.definitionsTitle} intro={section.definitionsIntro} definitions={section.definitions} strings={strings} /> : null}
          {section.steps?.length ? (
            <ol className="mt-7 space-y-8 border-l-2 border-primary/20 pl-5 sm:pl-7">
              {section.steps.map((step, stepIndex) => (
                <li key={`${step.title}-${stepIndex}`} className="relative">
                  <span className="absolute -left-[2.05rem] top-0 flex size-7 items-center justify-center rounded-full border-2 border-primary bg-background text-xs font-bold text-primary sm:-left-[2.65rem]" aria-hidden="true">
                    {stepIndex + 1}
                  </span>
                  <h3 className="text-lg font-bold text-foreground">{strings[step.title]}</h3>
                  {step.where ? <p className="mt-1 font-mono text-xs text-muted-foreground">{strings.whereLabel}: {step.where}</p> : null}
                  <p className="mt-2 leading-7">{strings[step.body]}</p>
                  {step.see ? (
                    <p className="mt-3 border-l-4 border-primary/30 bg-primary/5 px-4 py-2 text-sm leading-6 text-muted-foreground">
                      <span className="font-semibold text-foreground">{strings.seeLabel}: </span>
                      {strings[step.see]}
                    </p>
                  ) : null}
                  {step.figures ? <Figures figures={step.figures} strings={strings} /> : null}
                </li>
              ))}
            </ol>
          ) : null}
          {section.figures ? <Figures figures={section.figures} strings={strings} /> : null}
        </>
      )}
    </section>
  );
}

export function HowTo({ language }: { language: Language }) {
  const strings = howToStrings[language];
  const sections = getHowToSections(TEST_GUIDE_ENABLED);
  return (
    <div id="top" className="how-to-page scroll-mt-24 mx-auto max-w-7xl">
      <div className="mb-10 flex flex-col gap-5 border-b pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[68ch]">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">{strings.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{strings.pageTitle}</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">{strings.lead}</p>
        </div>
        <Button type="button" variant="outline" className="how-to-print-control min-h-11 shrink-0" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          {strings.printGuide}
        </Button>
      </div>

      <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-14">
        <aside className="how-to-toc lg:sticky lg:top-24" aria-label={strings.contents}>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{strings.contents}</p>
          <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-2 lg:grid lg:gap-2">
            {sections.map((section, index) => (
              <a key={section.id} href={`#${section.id}`} className="text-sm leading-6 text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {index + 1}. {strings[section.title]}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-[84ch] space-y-12">
          {sections.map((section, index) => (
            <Section key={section.id} section={section} strings={strings} index={index} />
          ))}
          <div className="how-to-print-control flex justify-end border-t pt-6">
            <a href="#top" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
              <ArrowUp aria-hidden="true" className="size-4" />
              {strings.backToTop}
            </a>
          </div>
        </article>
      </div>
    </div>
  );
}
