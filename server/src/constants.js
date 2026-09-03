export const CATEGORIES = ["goods", "shelter", "transport", "medical", "skilled-labor", "funds-guidance"];
export const LANGUAGES = ["en", "ne"];
export const PUBLIC_NEED_STATUSES = ["published", "matched", "fulfilled"];
export const PUBLIC_OFFER_STATUSES = ["published", "matched", "fulfilled"];
export const MOD_STATUS = ["matched", "fulfilled", "archived"];
export const FLAG_REASONS = ["already_received", "not_real", "other"];
export const PROJECT_TYPES = ["tuin", "bridge", "trail", "water", "school", "other"];
export const PUBLIC_PROJECT_STATUSES = ["published", "in-progress", "completed"];
export const PROJECT_ALL_STATUSES = ["pending", "published", "in-progress", "completed", "rejected", "archived"];
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_SIZE = 8 * 1024 * 1024;
export const DISPATCH_TAGS = ["climate", "mountains", "floods", "landslides", "glaciers", "community", "story"];

// Keep in sync with src/lib/climate-messages.ts (client test checks both lists match).
export const CLIMATE_MESSAGE_IDS = [
  "stop-heating-us",
  "please-cool-down",
  "cool-down-already",
  "keep-it-cool",
  "enough-with-heating",
  "let-us-breathe",
  "give-us-air",
  "leave-our-glaciers",
  "protect-our-himalayas",
  "save-our-glaciers",
  "our-glaciers-melt",
  "our-mountains-suffer",
  "dont-melt-us",
  "dont-melt-nepal",
  "keep-mountains-frozen",
  "save-our-mountains",
  "nice-job-guys",
  "thanks-for-heating",
  "really-more-emissions",
  "could-you-not",
  "maybe-stop-now",
  "your-turn-cool",
  "we-didnt-ask",
  "not-cool-guys",
  "thats-enough-guys",
  "youve-done-enough",
  "we-feel-everything",
  "we-pay-anyway",
  "we-didnt-cause",
  "we-deserve-better",
  "we-need-cooling",
  "let-nepal-breathe",
  "dont-make-us",
  "our-future-matters",
];
export const CLIMATE_DOWNLOAD_KINDS = ["ranking", "trend", "composition", "map", "wordcloud", "message"];
