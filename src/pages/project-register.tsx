import { useState } from "react";
import { ApiError, createProject, type ProjectType } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { districtNames, districtLabels } from "../geo";
import { labels } from "../i18n";
import type { Language } from "../types";
import { TurnstileWidget } from "../components/turnstile";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export function ProjectRegister({ language }: { language: Language }) {
  const t = labels[language] as Record<string,string>;
  const [titleEn, setTitleEn] = useState("");
  const [titleNe, setTitleNe] = useState("");
  const [descEn, setDescEn] = useState("");
  const [descNe, setDescNe] = useState("");
  const [type, setType] = useState<ProjectType>("tuin");
  const [district, setDistrict] = useState<string>(districtNames[0] ?? "Rasuwa");
  const [ward, setWard] = useState("1");
  const [locationText, setLocationText] = useState("");
  const [cost, setCost] = useState("");
  const [committeeName, setCommitteeName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [committeeEmail, setCommitteeEmail] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [esewaId, setEsewaId] = useState("");
  const [khaltiId, setKhaltiId] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string|null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{id:string; updateCode:string}|null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent)=>{
    e.preventDefault();
    setError(null);
    if (!titleEn.trim() || !descEn.trim() || !committeeName.trim() || !contactName.trim() || !phone.trim() || !bankName.trim() || !accountName.trim() || !accountNumber.trim() || !locationText.trim()) {
      setError(t.projectRegisterValidationRequired); return;
    }
    const wardNum = Number(ward);
    if (Number.isNaN(wardNum) || wardNum<1 || wardNum>33) { setError(t.projectRegisterValidationRequired); return; }
    const costNum = Number(cost);
    if (!cost || Number.isNaN(costNum) || costNum < 0) { setError(t.projectRegisterValidationRequired); return; }
    setSubmitting(true);
    try{
      const res = await createProject({
        title: { en: titleEn.trim(), ne: titleNe.trim() || undefined },
        description: { en: descEn.trim(), ne: descNe.trim() || undefined },
        type,
        district,
        ward: wardNum,
        locationText: locationText.trim(),
        costEstimateNpr: costNum,
        committee: {
          name: committeeName.trim(),
          contactName: contactName.trim(),
          phone: phone.trim(),
          email: committeeEmail.trim() || undefined,
          bank: { bankName: bankName.trim(), accountName: accountName.trim(), accountNumber: accountNumber.trim() },
          esewaId: esewaId.trim() || undefined,
          khaltiId: khaltiId.trim() || undefined,
        },
        turnstileToken: turnstileToken || undefined,
      });
      setResult(res);
    } catch(e){
      const err = e as ApiError;
      if (err.status===0) setError(t.projectsOffline);
      else setError(err.message || t.projectRegisterError);
    } finally { setSubmitting(false); }
  };

  if (result) {
    const projectUrl = `${window.location.origin}/projects/${encodeURIComponent(result.id)}`;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-ink">
          <CardHeader><CardTitle className="text-xl">{t.projectRegisterSuccessTitle}</CardTitle><p className="font-sans text-sm text-muted-foreground">{t.projectRegisterSuccessBody}</p></CardHeader>
          <CardContent className="space-y-6">
            <div className="border border-rule bg-secondary px-4 py-6 text-center">
              <p className="font-sans text-xs uppercase tracking-wide text-muted-foreground">{t.projectRegisterUpdateCodeLabel}</p>
              <p className="mt-3 break-all font-mono text-3xl font-bold tracking-widest text-ink sm:text-4xl" aria-live="polite">{result.updateCode}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={async()=>{ try{ await navigator.clipboard.writeText(result.updateCode); setCopied(true); setTimeout(()=>setCopied(false),2000);}catch{}}}>
                {copied ? t.projectRegisterCodeCopied : t.projectRegisterCopyCode}
              </Button>
              <p className="mt-3 font-sans text-xs leading-5 text-muted-foreground">{t.projectRegisterUpdateCodeHint}</p>
            </div>
            <div className="border border-amber-200 bg-amber-50 px-4 py-3">
              <h3 className="font-display text-base font-semibold">{t.projectRegisterWhatNextTitle}</h3>
              <p className="mt-2 font-sans text-sm leading-6 text-amber-900">{t.projectRegisterWhatNextBody}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={projectUrl} className="inline-flex h-9 items-center border border-ink bg-ink px-4 font-sans text-xs font-semibold uppercase tracking-wide text-paper">{t.projectsViewProject}</a>
              <a href="/projects" className="inline-flex h-9 items-center border border-rule bg-paper px-4 font-sans text-xs font-semibold uppercase tracking-wide text-ink">{t.projectRegisterBackToProjects}</a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b border-rule pb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">{t.projectRegisterTitle}</h1>
        <p className="mt-2 font-sans text-sm leading-6 text-muted-foreground">{t.projectRegisterLead}</p>
      </header>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Project details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="titleEn">{t.projectRegisterTitleLabel} *</Label>
              <Input id="titleEn" value={titleEn} onChange={e=>setTitleEn(e.target.value)} required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="titleNe">{t.projectRegisterTitleNeLabel}</Label>
              <Input id="titleNe" value={titleNe} onChange={e=>setTitleNe(e.target.value)} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="descEn">{t.projectRegisterDescLabel} *</Label>
              <Textarea id="descEn" value={descEn} onChange={e=>setDescEn(e.target.value)} required rows={4} maxLength={2000} />
            </div>
            <div>
              <Label htmlFor="descNe">{t.projectRegisterDescNeLabel}</Label>
              <Textarea id="descNe" value={descNe} onChange={e=>setDescNe(e.target.value)} rows={4} maxLength={2000} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t.projectRegisterTypeLabel} *</Label>
                <Select value={type} onChange={e=>setType(e.target.value as ProjectType)}>
                  { (["tuin","bridge","trail","water","school","other"] as ProjectType[]).map(v=> <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </Select>
              </div>
              <div>
                <Label>{t.projectRegisterDistrictLabel} *</Label>
                <Select value={district} onChange={e=>setDistrict(e.target.value as string)}>
                  {districtNames.map(d=> <SelectItem key={d} value={d}>{districtLabels[d as keyof typeof districtLabels][language]}</SelectItem>)}
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ward">{t.projectRegisterWardLabel} *</Label>
                <Input id="ward" type="number" min={1} max={33} value={ward} onChange={e=>setWard(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="cost">{t.projectRegisterCostLabel} *</Label>
                <Input id="cost" type="number" min={0} value={cost} onChange={e=>setCost(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label htmlFor="loc">{t.projectRegisterLocationLabel} *</Label>
              <Input id="loc" value={locationText} onChange={e=>setLocationText(e.target.value)} required placeholder={t.projectRegisterLocationHint} />
              <p className="mt-1 font-sans text-xs text-muted-foreground">{t.projectRegisterLocationHint}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t.projectRegisterCommitteeTitle}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="cname">{t.projectRegisterCommitteeName} *</Label>
              <Input id="cname" value={committeeName} onChange={e=>setCommitteeName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="contactName">{t.projectRegisterContactName} *</Label>
              <Input id="contactName" value={contactName} onChange={e=>setContactName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="phone">{t.projectRegisterPhone} *</Label>
              <Input id="phone" value={phone} onChange={e=>setPhone(e.target.value)} required placeholder="+977-98XXXXXXXX" />
            </div>
            <div>
              <Label htmlFor="committeeEmail">{t.projectRegisterEmail}</Label>
              <Input id="committeeEmail" value={committeeEmail} onChange={e=>setCommitteeEmail(e.target.value)} type="email" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t.projectRegisterBankTitle}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label htmlFor="bankName">{t.projectRegisterBankName} *</Label><Input id="bankName" value={bankName} onChange={e=>setBankName(e.target.value)} required /></div>
            <div><Label htmlFor="accName">{t.projectRegisterAccountName} *</Label><Input id="accName" value={accountName} onChange={e=>setAccountName(e.target.value)} required /></div>
            <div><Label htmlFor="accNum">{t.projectRegisterAccountNumber} *</Label><Input id="accNum" value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="esewa">{t.projectRegisterEsewa}</Label><Input id="esewa" value={esewaId} onChange={e=>setEsewaId(e.target.value)} /></div>
              <div><Label htmlFor="khalti">{t.projectRegisterKhalti}</Label><Input id="khalti" value={khaltiId} onChange={e=>setKhaltiId(e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>

        {TURNSTILE_KEY ? <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setTurnstileToken} /> : <p className="font-sans text-xs text-muted-foreground">{t.projectRegisterTurnstileHint}</p>}

        {error ? <p className="font-sans text-sm text-destructive" role="alert">{error}</p> : null}

        <Button type="submit" disabled={submitting} className="w-full">{submitting ? t.projectRegisterSubmitting : t.projectRegisterSubmit}</Button>
      </form>
    </div>
  );
}
