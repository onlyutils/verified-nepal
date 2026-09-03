import type { Language } from "@/lib/types";

export interface ClimateMessage {
  id: string;
  text: string;
}

export interface ClimateMessageGroup {
  id: string;
  emoji: string;
  label: Record<Language, string>;
  messages: ClimateMessage[];
}

export const CLIMATE_MESSAGE_GROUPS: ClimateMessageGroup[] = [
  {
    id: "direct",
    emoji: "\u{1F30D}",
    label: { en: "Direct", ne: "सीधा" },
    messages: [
      { id: "stop-heating-us", text: "Stop Heating Us" },
      { id: "please-cool-down", text: "Please Cool Down" },
      { id: "cool-down-already", text: "Cool Down Already" },
      { id: "keep-it-cool", text: "Keep It Cool" },
      { id: "enough-with-heating", text: "Enough With Heating" },
      { id: "let-us-breathe", text: "Let Us Breathe" },
      { id: "give-us-air", text: "Give Us Air" },
      { id: "leave-our-glaciers", text: "Leave Our Glaciers" },
    ],
  },
  {
    id: "nepal",
    emoji: "\u{1F3D4}\uFE0F",
    label: { en: "Nepal-focused", ne: "नेपाल-केन्द्रित" },
    messages: [
      { id: "protect-our-himalayas", text: "Protect Our Himalayas" },
      { id: "save-our-glaciers", text: "Save Our Glaciers" },
      { id: "our-glaciers-melt", text: "Our Glaciers Melt" },
      { id: "our-mountains-suffer", text: "Our Mountains Suffer" },
      { id: "dont-melt-us", text: "Don't Melt Us" },
      { id: "dont-melt-nepal", text: "Don't Melt Nepal" },
      { id: "keep-mountains-frozen", text: "Keep Mountains Frozen" },
      { id: "save-our-mountains", text: "Save Our Mountains" },
    ],
  },
  {
    id: "sarcastic",
    emoji: "\u{1F60F}",
    label: { en: "Slightly sarcastic", ne: "अलि व्यङ्ग्यात्मक" },
    messages: [
      { id: "nice-job-guys", text: "Nice Job, Guys" },
      { id: "thanks-for-heating", text: "Thanks For Heating" },
      { id: "really-more-emissions", text: "Really? More Emissions?" },
      { id: "could-you-not", text: "Could You Not?" },
      { id: "maybe-stop-now", text: "Maybe Stop Now" },
      { id: "your-turn-cool", text: "Your Turn, Cool" },
      { id: "we-didnt-ask", text: "We Didn't Ask" },
      { id: "not-cool-guys", text: "Not Cool, Guys" },
      { id: "thats-enough-guys", text: "That's Enough, Guys" },
      { id: "youve-done-enough", text: "You've Done Enough" },
    ],
  },
  {
    id: "powerful",
    emoji: "\u2764\uFE0F",
    label: { en: "More powerful", ne: "अझ सशक्त" },
    messages: [
      { id: "we-feel-everything", text: "We Feel Everything" },
      { id: "we-pay-anyway", text: "We Pay Anyway" },
      { id: "we-didnt-cause", text: "We Didn't Cause" },
      { id: "we-deserve-better", text: "We Deserve Better" },
      { id: "we-need-cooling", text: "We Need Cooling" },
      { id: "let-nepal-breathe", text: "Let Nepal Breathe" },
      { id: "dont-make-us", text: "Don't Make Us" },
      { id: "our-future-matters", text: "Our Future Matters" },
    ],
  },
];

export const CLIMATE_MESSAGES: ClimateMessage[] = CLIMATE_MESSAGE_GROUPS.flatMap((g) => g.messages);

export function messageText(id: string) {
  return CLIMATE_MESSAGES.find((m) => m.id === id)?.text ?? id;
}

export type ClimateDownloadKind = "ranking" | "trend" | "composition" | "map" | "wordcloud" | "message";
export const CLIMATE_DOWNLOAD_KINDS: ClimateDownloadKind[] = ["ranking", "trend", "composition", "map", "wordcloud", "message"];
