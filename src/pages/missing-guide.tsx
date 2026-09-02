import { labels } from "@/i18n";
import type { Language, Page } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Phone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { helplines } from "@/lib/helplines";
import { opmcmMissingPersonUrl, opmcmUnidentifiedUrl } from "@/lib/urls";

type Step = { title: string; body: string[]; cta?: "search" | "report" | "unidentified" };

// Written for families of people out of contact since the Rasuwa / Bhote Koshi flood.
// Facts here (hospitals, border channel, police/DAO roles) are the standard Nepal
// disaster-response routing; hotline numbers come from ./helplines via EmergencyContacts.
const copy = {
  en: {
    intro:
      "This page is for the family and friends of someone who has been out of contact since the Rasuwa / Bhote Koshi flood. It is written by volunteers, not the government, and it cannot search for anyone physically. It puts the official steps in the order that helps most, with the numbers we have verified.",
    steps: [
      {
        title: "Search the official lists first",
        body: [
          "Search the name — in English and in Devanagari, and any nickname — on our Find a person page. It checks NDRRMA's rescued and missing lists and the public reports on the government's OPMCM rescue portal.",
          "Not being listed is not proof of anything. Lists are updated continuously, so search again every day.",
        ],
        cta: "search",
      },
      {
        title: "Register the missing person on the government portal",
        body: [
          "If they are not on the OPMCM list, report them there. This is the list rescue teams, district offices and hospitals work from. Have ready: full name and nickname, age, a clear photo, the place and time they were last seen or in contact, what they were doing there (work, travel, pilgrimage), their phone number, clothing and distinguishing marks, and a contact number for the family.",
          "After submitting, search the name again here. The report appears in the public list right away, so you can confirm it went through.",
        ],
        cta: "report",
      },
      {
        title: "File with Nepal Police and the District Administration Office",
        body: [
          "Call 100 or go to the nearest police station and file a missing-person report, and inform the District Administration Office (CDO office) of your home district. A police record is required for a phone-location request to the telecom operator and for identification matching later. DAO reports also feed the official lists.",
        ],
      },
      {
        title: "Ask the hospitals",
        body: [
          "People rescued unconscious or without ID are admitted as unidentified patients. Ask the district hospital in Dhunche, Trishuli Hospital in Nuwakot and the major Kathmandu hospitals (TU Teaching Hospital, Bir Hospital, National Trauma Centre) whether they have an unidentified patient matching the age and description. Rescue flights from Rasuwa often land in Kathmandu.",
        ],
      },
      {
        title: "If they were near the Rasuwagadhi border",
        body: [
          "People at the Rasuwagadhi / Kerung crossing or the dry port may have been taken to the Chinese side. Ask the Ministry of Home Affairs flood control room (1112) and the Ministry of Foreign Affairs control room to check; the MoFA number is listed below under the hotlines.",
        ],
      },
      {
        title: "Unidentified persons",
        body: [
          "The OPMCM portal also keeps a list of unidentified people recovered from the river, with photos, for families to check. Out of respect for families we do not mirror it here. Please have someone with you if you look.",
        ],
        cta: "unidentified",
      },
      {
        title: "Protect the family",
        body: [
          "Choose one family member as the contact person so agencies and volunteers do not call everyone. Check the lists once a day rather than all night.",
          "No rescue team, hospital, police officer or government office will ever ask you for money to find or release a relative. If someone asks for payment, hang up and give the number to the police.",
        ],
      },
    ] as Step[],
    closing:
      "We are volunteers. If you have searched and registered and still need help with these steps, write to verifiednepal01@gmail.com and we will help you check the lists.",
    search: "Find a person",
    report: "Report on the OPMCM portal",
    unidentified: "Unidentified persons list (OPMCM)",
    hotlines: "Verified hotlines",
  },
  ne: {
    intro:
      "यो पृष्ठ रसुवा / भोटेकोशी बाढीपछि सम्पर्कविहीन भएका व्यक्तिका परिवार र आफन्तका लागि हो। यो स्वयंसेवकहरूले लेखेका हुन्, सरकारले होइन, र यसले कसैलाई भौतिक रूपमा खोज्न सक्दैन। यसले आधिकारिक कदमहरूलाई सबैभन्दा उपयोगी क्रममा राख्छ, हामीले प्रमाणित गरेका नम्बरसहित।",
    steps: [
      {
        title: "पहिले आधिकारिक सूचीहरूमा खोज्नुहोस्",
        body: [
          "हाम्रो व्यक्ति खोज्नुहोस् पृष्ठमा नाम खोज्नुहोस् — अंग्रेजी र देवनागरी दुवैमा, र बोलाउने नाम पनि। यसले NDRRMA का उद्धार र बेपत्ता सूची तथा सरकारी OPMCM उद्धार पोर्टलका सार्वजनिक रिपोर्टहरू जाँच्छ।",
          "सूचीमा नहुनु कुनै कुराको प्रमाण होइन। सूचीहरू निरन्तर अद्यावधिक हुन्छन्, त्यसैले हरेक दिन फेरि खोज्नुहोस्।",
        ],
        cta: "search",
      },
      {
        title: "सरकारी पोर्टलमा बेपत्ता व्यक्ति दर्ता गर्नुहोस्",
        body: [
          "OPMCM सूचीमा नभए त्यहाँ दर्ता गर्नुहोस्। उद्धार टोली, जिल्ला प्रशासन कार्यालय र अस्पतालले यही सूचीबाट काम गर्छन्। तयार राख्नुहोस्: पूरा नाम र बोलाउने नाम, उमेर, स्पष्ट फोटो, अन्तिम पटक देखिएको वा सम्पर्क भएको स्थान र समय, उहाँ त्यहाँ के गर्दै हुनुहुन्थ्यो (काम, यात्रा, तीर्थ), उहाँको फोन नम्बर, लगाएको कपडा र चिनिने चिह्न, र परिवारको सम्पर्क नम्बर।",
          "दर्ता गरेपछि यहाँ फेरि नाम खोज्नुहोस्। रिपोर्ट तुरुन्तै सार्वजनिक सूचीमा देखिन्छ, त्यसैले दर्ता भयो कि भएन पुष्टि गर्न सक्नुहुन्छ।",
        ],
        cta: "report",
      },
      {
        title: "नेपाल प्रहरी र जिल्ला प्रशासन कार्यालयमा जानकारी दिनुहोस्",
        body: [
          "१०० मा फोन गर्नुहोस् वा नजिकको प्रहरी कार्यालयमा गएर बेपत्ता व्यक्तिको उजुरी दर्ता गर्नुहोस्, र आफ्नो गृह जिल्लाको जिल्ला प्रशासन कार्यालय (प्रजिअ कार्यालय) लाई जानकारी दिनुहोस्। टेलिकमबाट फोनको अन्तिम स्थान माग्न र पछि पहिचान मिलाउन प्रहरी अभिलेख आवश्यक हुन्छ। जिल्ला प्रशासनका रिपोर्टहरू पनि आधिकारिक सूचीमा जान्छन्।",
        ],
      },
      {
        title: "अस्पतालहरूमा सोध्नुहोस्",
        body: [
          "बेहोस वा परिचयपत्रबिना उद्धार गरिएका व्यक्तिहरू अज्ञात बिरामीका रूपमा भर्ना हुन्छन्। धुन्चेको जिल्ला अस्पताल, नुवाकोटको त्रिशूली अस्पताल र काठमाडौंका ठूला अस्पताल (टिचिङ अस्पताल, वीर अस्पताल, राष्ट्रिय ट्रमा सेन्टर) मा उमेर र हुलिया मिल्ने अज्ञात बिरामी छन् कि भनी सोध्नुहोस्। रसुवाबाट उद्धार उडानहरू प्रायः काठमाडौं आउँछन्।",
        ],
      },
      {
        title: "उहाँ रसुवागढी नाका नजिक हुनुहुन्थ्यो भने",
        body: [
          "रसुवागढी / केरुङ नाका वा सुक्खा बन्दरगाह क्षेत्रमा भएका व्यक्तिहरू चिनियाँ तर्फ लगिएको हुन सक्छ। गृह मन्त्रालयको बाढी नियन्त्रण कक्ष (१११२) र परराष्ट्र मन्त्रालयको नियन्त्रण कक्षमा जाँच गर्न अनुरोध गर्नुहोस्; परराष्ट्रको नम्बर तल हटलाइनमा छ।",
        ],
      },
      {
        title: "अज्ञात व्यक्तिहरूको सूची",
        body: [
          "OPMCM पोर्टलमा नदीबाट फेला परेका अज्ञात व्यक्तिहरूको फोटोसहितको सूची पनि छ, जुन परिवारले हेर्न सक्छन्। परिवारप्रति सम्मान राख्दै हामी त्यो सूची यहाँ देखाउँदैनौं। हेर्दा कृपया कोही साथमा राख्नुहोस्।",
        ],
        cta: "unidentified",
      },
      {
        title: "परिवारलाई सुरक्षित राख्नुहोस्",
        body: [
          "निकाय र स्वयंसेवकहरूले सबैलाई फोन नगरून् भनेर परिवारबाट एक जनालाई सम्पर्क व्यक्ति तोक्नुहोस्। रातभर होइन, दिनमा एक पटक सूची जाँच्नुहोस्।",
          "कुनै पनि उद्धार टोली, अस्पताल, प्रहरी वा सरकारी कार्यालयले आफन्त खोज्न वा छोड्न पैसा माग्दैन। कसैले पैसा मागे फोन काट्नुहोस् र नम्बर प्रहरीलाई दिनुहोस्।",
        ],
      },
    ] as Step[],
    closing:
      "हामी स्वयंसेवक हौं। खोजिसक्नुभयो, दर्ता गरिसक्नुभयो, र पनि यी कदममा सहयोग चाहिए verifiednepal01@gmail.com मा लेख्नुहोस्; हामी सूची जाँच्न सहयोग गर्छौं।",
    search: "व्यक्ति खोज्नुहोस्",
    report: "OPMCM पोर्टलमा दर्ता गर्नुहोस्",
    unidentified: "अज्ञात व्यक्तिहरूको सूची (OPMCM)",
    hotlines: "प्रमाणित हटलाइनहरू",
  },
} satisfies Record<Language, unknown>;

export function MissingGuide({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = labels[language];
  const c = copy[language];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow={t.missingPersonsLabel} title={t.missingGuideTitle} description={c.intro} />
      <ol className="space-y-4">
        {c.steps.map((step, index) => (
          <li key={step.title}>
            <Card>
              <CardHeader className="flex-row items-start gap-4 space-y-0">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary"
                >
                  {index + 1}
                </span>
                <CardTitle className="pt-1 text-lg">{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pl-[4.5rem] text-base leading-relaxed">
                {step.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {step.cta === "search" ? (
                  <Button type="button" onClick={() => navigate("search")} className="mt-2">
                    {c.search}
                  </Button>
                ) : null}
                {step.cta === "report" ? (
                  <Button asChild className="mt-2">
                    <a href={opmcmMissingPersonUrl} target="_blank" rel="noopener noreferrer">
                      {c.report}
                      <ExternalLink aria-hidden="true" />
                    </a>
                  </Button>
                ) : null}
                {step.cta === "unidentified" ? (
                  <Button asChild className="mt-2">
                    <a href={opmcmUnidentifiedUrl} target="_blank" rel="noopener noreferrer">
                      {c.unidentified}
                      <ExternalLink aria-hidden="true" />
                    </a>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
      <Card>
        <CardHeader>
          <CardTitle>{c.hotlines}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {helplines.map((helpline) => (
            <a
              key={helpline.key}
              href={`tel:${helpline.number}`}
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg border p-4 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Phone aria-hidden="true" className="size-5 shrink-0 text-destructive" />
                <span className="text-sm font-medium">{language === "ne" ? helpline.labelNe : helpline.labelEn}</span>
              </span>
              <span className="shrink-0 text-lg font-bold tabular-nums text-destructive">{helpline.number}</span>
            </a>
          ))}
        </CardContent>
      </Card>
      <p className="text-base leading-relaxed text-muted-foreground">{c.closing}</p>
    </div>
  );
}
