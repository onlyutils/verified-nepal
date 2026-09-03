import { useMemo, useState } from "react";
import { postClimateMessage } from "@/lib/api";
import { CLIMATE_MESSAGE_GROUPS, messageText } from "@/lib/climate-messages";
import type { ClimateFacts, CountryClimate } from "@/lib/climate-data";
import { interpolate } from "@/lib/format";
import type { Language } from "@/lib/types";
import { TurnstileWidget } from "@/components/turnstile";
import { ShareButton } from "@/components/climate/share-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function MessageWall({
  language,
  t,
  countries,
  facts,
  onSent,
}: {
  language: Language;
  t: Record<string, string>;
  countries: CountryClimate[];
  facts: ClimateFacts;
  onSent: (messageId: string, iso3: string) => void;
}) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const options = useMemo(
    () => countries.filter((country) => country.iso3 !== "NPL").sort((a, b) => a.name.localeCompare(b.name)),
    [countries],
  );
  const [iso3, setIso3] = useState(facts.top.iso3);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [widgetKey, setWidgetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState<{ count: number; messageId: string; iso3: string } | null>(null);

  const country = countries.find((item) => item.iso3 === iso3) ?? facts.top;
  const canSubmit = Boolean(messageId) && !submitting && (!siteKey || Boolean(turnstileToken));

  const resetToken = () => {
    setTurnstileToken("");
    setWidgetKey((key) => key + 1);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!messageId || !canSubmit) return;
    setSubmitting(true);
    setError(false);
    setSent(null);
    try {
      const result = await postClimateMessage({ iso3: country.iso3, messageId, turnstileToken });
      setSent({ count: result.count, messageId, iso3: country.iso3 });
      onSent(messageId, country.iso3);
      resetToken();
    } catch {
      setError(true);
      resetToken();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="climate-message-country">{t.messagesCountryLabel}</Label>
          <span className="text-sm text-muted-foreground">{t.messagesFrom}</span>
        </div>
        <NativeSelect
          id="climate-message-country"
          value={country.iso3}
          onChange={(event) => {
            setIso3(event.target.value);
            setSent(null);
            setError(false);
          }}
          className="max-w-sm"
        >
          {options.map((option) => (
            <NativeSelectOption key={option.iso3} value={option.iso3}>
              {option.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-4">
        {CLIMATE_MESSAGE_GROUPS.map((group) => (
          <fieldset key={group.id} className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">
              {group.emoji} {group.label[language]}
            </legend>
            <div className="flex flex-wrap gap-2">
              {group.messages.map((item) => {
                const selected = item.id === messageId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setMessageId(item.id);
                      setSent(null);
                      setError(false);
                    }}
                    className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      selected ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"
                    }`}
                  >
                    {item.text}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {siteKey ? <TurnstileWidget key={widgetKey} siteKey={siteKey} onToken={setTurnstileToken} /> : null}
      {siteKey && !turnstileToken ? <p className="text-sm text-muted-foreground">{t.messagesHumanCheck}</p> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{t.messagesError}</AlertDescription>
        </Alert>
      ) : null}
      {sent ? (
        <div className="space-y-3">
          <Alert className="border-success/50 bg-success-soft text-success">
            <AlertDescription>
              {interpolate(t.messagesSent, {
                count: sent.count,
                message: messageText(sent.messageId),
                country: countries.find((item) => item.iso3 === sent.iso3)?.name ?? sent.iso3,
              })}
            </AlertDescription>
          </Alert>
          <ShareButton
            kind="message"
            filename={`verifiednepal-message-${sent.iso3}.png`}
            headline={messageText(sent.messageId)}
            subline={`${interpolate(t.cardTo, { country: country.name })} · ${t.cardFrom}`}
            message={undefined}
            footnote={interpolate(t.cardStat, {
              nepalShare: facts.nepalShare,
              country: country.name,
              countryShare: country.share_pct.toFixed(2),
            })}
            labels={{ download: t.downloadMessageCard, share: t.shareImage, exportError: t.exportError }}
          />
        </div>
      ) : null}
      <Button type="submit" disabled={!canSubmit}>
        {t.messagesSubmit}
      </Button>
    </form>
  );
}
