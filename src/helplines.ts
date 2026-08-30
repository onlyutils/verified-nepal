// Verified 2026-08-30 against primary sources:
// 1234 replaced the old 1149 NEOC hotline nationwide in July 2026 (MoHA/DEOC
// rollout; MoHA's own page still shows 1149). 1112 and the +977 numbers are the
// flood-specific control rooms MoHA/MoFA published on 2026-08-27. Fire 101 is
// Nepal's long-standing standard but lacked a reachable primary source at
// verification time — recheck before production.
export const helplines = [
  {
    key: "disaster-hotline",
    labelEn: "Disaster hotline (NEOC/DEOC)",
    labelNe: "विपद् हटलाइन (राष्ट्रिय आपतकालीन कार्य सञ्चालन केन्द्र)",
    number: "1234",
    runBy: "Ministry of Home Affairs",
  },
  {
    key: "moha-flood-control",
    labelEn: "Flood control room (MoHA, toll-free)",
    labelNe: "बाढी नियन्त्रण कक्ष (गृह मन्त्रालय, नि:शुल्क)",
    number: "1112",
    runBy: "Ministry of Home Affairs",
  },
  {
    key: "police",
    labelEn: "Nepal Police",
    labelNe: "नेपाल प्रहरी",
    number: "100",
    runBy: "Nepal Police",
  },
  {
    key: "ambulance",
    labelEn: "Ambulance",
    labelNe: "एम्बुलेन्स",
    number: "102",
    runBy: "Health Emergency Operation Center",
  },
  {
    key: "fire",
    labelEn: "Fire brigade",
    labelNe: "दमकल",
    number: "101",
    runBy: "Government of Nepal",
  },
  {
    key: "moha-control-landline",
    labelEn: "Flood control room (MoHA, landline)",
    labelNe: "बाढी नियन्त्रण कक्ष (गृह मन्त्रालय)",
    number: "+97714211208",
    runBy: "Ministry of Home Affairs",
  },
  {
    key: "mofa-foreigners",
    labelEn: "Foreign nationals — MoFA control room (7am–10pm, WhatsApp)",
    labelNe: "विदेशी नागरिकका लागि — परराष्ट्र मन्त्रालय (बिहान ७ – राति १०, WhatsApp)",
    number: "+9779744441227",
    runBy: "Ministry of Foreign Affairs",
  },
  {
    key: "red-cross",
    labelEn: "Nepal Red Cross hotline",
    labelNe: "नेपाल रेडक्रस हटलाइन",
    number: "1130",
    runBy: "Nepal Red Cross Society",
  },
  {
    key: "child-helpline",
    labelEn: "Child Helpline",
    labelNe: "बाल हेल्पलाइन",
    number: "1098",
    runBy: "CWIN Nepal",
  },
  {
    key: "tourist-police",
    labelEn: "Tourist Police",
    labelNe: "पर्यटक प्रहरी",
    number: "1144",
    runBy: "Nepal Police",
  },
];
