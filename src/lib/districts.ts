/** District names and labels, kept free of JSON imports so pure modules (and node tests) can use them. */
export type DistrictName =
  | "Rasuwa"
  | "Nuwakot"
  | "Sindhupalchok"
  | "Achham"
  | "Arghakhanchi"
  | "Baglung"
  | "Baitadi"
  | "Bajhang"
  | "Bajura"
  | "Banke"
  | "Bara"
  | "Bardiya"
  | "Bhaktapur"
  | "Bhojpur"
  | "Chitwan"
  | "Dadeldhura"
  | "Dailekh"
  | "Dang"
  | "Darchula"
  | "Dhading"
  | "Dhankuta"
  | "Dhanusha"
  | "Dolakha"
  | "Dolpa"
  | "Doti"
  | "Gorkha"
  | "Gulmi"
  | "Humla"
  | "Ilam"
  | "Jajarkot"
  | "Jhapa"
  | "Jumla"
  | "Kailali"
  | "Kalikot"
  | "Kanchanpur"
  | "Kapilvastu"
  | "Kaski"
  | "Kathmandu"
  | "Kavrepalanchok"
  | "Khotang"
  | "Lalitpur"
  | "Lamjung"
  | "Mahottari"
  | "Makwanpur"
  | "Manang"
  | "Morang"
  | "Mugu"
  | "Mustang"
  | "Myagdi"
  | "Nawalpur"
  | "NawalparasiWest"
  | "Okhaldhunga"
  | "Palpa"
  | "Panchthar"
  | "Parbat"
  | "Parsa"
  | "Pyuthan"
  | "Ramechhap"
  | "Rautahat"
  | "Rolpa"
  | "RukumEast"
  | "RukumWest"
  | "Rupandehi"
  | "Salyan"
  | "Sankhuwasabha"
  | "Saptari"
  | "Sarlahi"
  | "Sindhuli"
  | "Siraha"
  | "Solukhumbu"
  | "Sunsari"
  | "Surkhet"
  | "Syangja"
  | "Tanahun"
  | "Taplejung"
  | "Tehrathum"
  | "Udayapur";

export const districtLabels: Record<DistrictName, { en: string; ne: string }> = {
  Rasuwa: { en: "Rasuwa", ne: "रसुवा" },
  Nuwakot: { en: "Nuwakot", ne: "नुवाकोट" },
  Sindhupalchok: { en: "Sindhupalchok", ne: "सिन्धुपाल्चोक" },
  Achham: { en: "Achham", ne: "अछाम" },
  Arghakhanchi: { en: "Arghakhanchi", ne: "अर्घाखाँची" },
  Baglung: { en: "Baglung", ne: "बागलुङ" },
  Baitadi: { en: "Baitadi", ne: "बैतडी" },
  Bajhang: { en: "Bajhang", ne: "बझाङ" },
  Bajura: { en: "Bajura", ne: "बाजुरा" },
  Banke: { en: "Banke", ne: "बाँके" },
  Bara: { en: "Bara", ne: "बारा" },
  Bardiya: { en: "Bardiya", ne: "बर्दिया" },
  Bhaktapur: { en: "Bhaktapur", ne: "भक्तपुर" },
  Bhojpur: { en: "Bhojpur", ne: "भोजपुर" },
  Chitwan: { en: "Chitwan", ne: "चितवन" },
  Dadeldhura: { en: "Dadeldhura", ne: "डडेल्धुरा" },
  Dailekh: { en: "Dailekh", ne: "दैलेख" },
  Dang: { en: "Dang", ne: "दाङ" },
  Darchula: { en: "Darchula", ne: "दार्चुला" },
  Dhading: { en: "Dhading", ne: "धादिङ" },
  Dhankuta: { en: "Dhankuta", ne: "धनकुटा" },
  Dhanusha: { en: "Dhanusha", ne: "धनुषा" },
  Dolakha: { en: "Dolakha", ne: "दोलखा" },
  Dolpa: { en: "Dolpa", ne: "डोल्पा" },
  Doti: { en: "Doti", ne: "डोटी" },
  Gorkha: { en: "Gorkha", ne: "गोरखा" },
  Gulmi: { en: "Gulmi", ne: "गुल्मी" },
  Humla: { en: "Humla", ne: "हुम्ला" },
  Ilam: { en: "Ilam", ne: "इलाम" },
  Jajarkot: { en: "Jajarkot", ne: "जाजरकोट" },
  Jhapa: { en: "Jhapa", ne: "झापा" },
  Jumla: { en: "Jumla", ne: "जुम्ला" },
  Kailali: { en: "Kailali", ne: "कैलाली" },
  Kalikot: { en: "Kalikot", ne: "कालिकोट" },
  Kanchanpur: { en: "Kanchanpur", ne: "कञ्चनपुर" },
  Kapilvastu: { en: "Kapilvastu", ne: "कपिलवस्तु" },
  Kaski: { en: "Kaski", ne: "कास्की" },
  Kathmandu: { en: "Kathmandu", ne: "काठमाडौं" },
  Kavrepalanchok: { en: "Kavrepalanchok", ne: "काभ्रेपलाञ्चोक" },
  Khotang: { en: "Khotang", ne: "खोटाङ" },
  Lalitpur: { en: "Lalitpur", ne: "ललितपुर" },
  Lamjung: { en: "Lamjung", ne: "लमजुङ" },
  Mahottari: { en: "Mahottari", ne: "महोत्तरी" },
  Makwanpur: { en: "Makwanpur", ne: "मकवानपुर" },
  Manang: { en: "Manang", ne: "मनाङ" },
  Morang: { en: "Morang", ne: "मोरङ" },
  Mugu: { en: "Mugu", ne: "मुगु" },
  Mustang: { en: "Mustang", ne: "मुस्ताङ" },
  Myagdi: { en: "Myagdi", ne: "म्याग्दी" },
  Nawalpur: { en: "Nawalpur", ne: "नवलपुर" },
  NawalparasiWest: { en: "Nawalparasi West", ne: "नवलपरासी (बर्दघाट सुस्ता पश्चिम)" },
  Okhaldhunga: { en: "Okhaldhunga", ne: "ओखलढुङ्गा" },
  Palpa: { en: "Palpa", ne: "पाल्पा" },
  Panchthar: { en: "Panchthar", ne: "पाँचथर" },
  Parbat: { en: "Parbat", ne: "पर्वत" },
  Parsa: { en: "Parsa", ne: "पर्सा" },
  Pyuthan: { en: "Pyuthan", ne: "प्यूठान" },
  Ramechhap: { en: "Ramechhap", ne: "रामेछाप" },
  Rautahat: { en: "Rautahat", ne: "रौतहट" },
  Rolpa: { en: "Rolpa", ne: "रोल्पा" },
  RukumEast: { en: "Rukum East", ne: "रुकुम (पूर्व)" },
  RukumWest: { en: "Rukum West", ne: "रुकुम (पश्चिम)" },
  Rupandehi: { en: "Rupandehi", ne: "रुपन्देही" },
  Salyan: { en: "Salyan", ne: "सल्यान" },
  Sankhuwasabha: { en: "Sankhuwasabha", ne: "सङ्खुवासभा" },
  Saptari: { en: "Saptari", ne: "सप्तरी" },
  Sarlahi: { en: "Sarlahi", ne: "सर्लाही" },
  Sindhuli: { en: "Sindhuli", ne: "सिन्धुली" },
  Siraha: { en: "Siraha", ne: "सिराहा" },
  Solukhumbu: { en: "Solukhumbu", ne: "सोलुखुम्बु" },
  Sunsari: { en: "Sunsari", ne: "सुनसरी" },
  Surkhet: { en: "Surkhet", ne: "सुर्खेत" },
  Syangja: { en: "Syangja", ne: "स्याङ्जा" },
  Tanahun: { en: "Tanahun", ne: "तनहुँ" },
  Taplejung: { en: "Taplejung", ne: "ताप्लेजुङ" },
  Tehrathum: { en: "Tehrathum", ne: "तेह्रथुम" },
  Udayapur: { en: "Udayapur", ne: "उदयपुर" },
};

export const districtNames = Object.keys(districtLabels) as DistrictName[];
