import { err } from "./http.js";
import { DISPATCH_TAGS } from "../constants.js";

export function validateString(v, name, min, max) {
  if (typeof v !== "string") throw err(400, `${name} must be a string`);
  const t = v.trim();
  if (t.length < min) throw err(400, `${name} must be at least ${min} characters`);
  if (t.length > max) throw err(400, `${name} must be at most ${max} characters`);
  return t;
}

export function validateOptionalString(v, name, min, max) {
  if (v === undefined || v === null) return undefined;
  return validateString(v, name, min, max);
}

export function validateDistrict(v, name = "district") {
  const t = validateString(v, name, 1, 100);
  if (t.includes("#")) throw err(400, `${name} contains an invalid character`);
  return t;
}

export function validatePhone(v, name = "phone") {
  if (typeof v !== "string") throw err(400, `${name} must be a string`);
  const t = v.trim();
  if (t.length < 5 || t.length > 30) throw err(400, `${name} must be 5-30 characters`);
  if (!/^\+?[0-9\-\s()]+$/.test(t)) throw err(400, `${name} contains invalid characters`);
  return t;
}

export function validateOptionalEmail(v, name = "email") {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") throw err(400, `${name} must be a string`);
  const t = v.trim();
  if (t.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw err(400, `${name} is not a valid email`);
  return t;
}

export function validateTitle(v, field) {
  if (v === undefined || v === null) throw err(400, `${field} required`);
  if (typeof v !== "object" || Array.isArray(v)) throw err(400, `${field} must be object`);
  const en = v.en;
  if (typeof en !== "string" || !en.trim() || en.trim().length < 1 || en.trim().length > 200) throw err(400, `${field}.en must be 1-200 characters`);
  let ne;
  if (v.ne !== undefined && v.ne !== null) {
    if (typeof v.ne !== "string") throw err(400, `${field}.ne must be string`);
    const t = v.ne.trim();
    if (t.length > 0) {
      if (t.length < 1 || t.length > 200) throw err(400, `${field}.ne must be 1-200 characters`);
      ne = t;
    }
  }
  const out = { en: en.trim() };
  if (ne !== undefined) out.ne = ne;
  return out;
}

export function validateDescription(v, field) {
  if (v === undefined || v === null) throw err(400, `${field} required`);
  if (typeof v !== "object" || Array.isArray(v)) throw err(400, `${field} must be object`);
  const en = v.en;
  if (typeof en !== "string" || !en.trim() || en.trim().length < 10 || en.trim().length > 5000) throw err(400, `${field}.en must be 10-5000 characters`);
  let ne;
  if (v.ne !== undefined && v.ne !== null) {
    if (typeof v.ne !== "string") throw err(400, `${field}.ne must be string`);
    const t = v.ne.trim();
    if (t.length > 0) {
      if (t.length < 10 || t.length > 5000) throw err(400, `${field}.ne must be 10-5000 characters`);
      ne = t;
    }
  }
  const out = { en: en.trim() };
  if (ne !== undefined) out.ne = ne;
  return out;
}

export function validateDispatchTitle(v) {
  if (v === undefined || v === null) throw err(400, "title required");
  if (typeof v === "object" && !Array.isArray(v)) {
    const en = v.en;
    if (typeof en !== "string" || !en.trim() || en.trim().length < 1 || en.trim().length > 200) throw err(400, "title.en must be 1-200 characters");
    let ne;
    if (v.ne !== undefined && v.ne !== null) {
      if (typeof v.ne !== "string") throw err(400, "title.ne must be string");
      const t = v.ne.trim();
      if (t.length > 0) {
        if (t.length < 1 || t.length > 200) throw err(400, "title.ne must be 1-200 characters");
        ne = t;
      }
    }
    const out = { en: en.trim() };
    if (ne !== undefined) out.ne = ne;
    return out;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (t.length < 1 || t.length > 200) throw err(400, "title must be 1-200 characters");
    return { __single: t };
  }
  throw err(400, "title must be string or object");
}

export function validateDispatchBody(v) {
  if (v === undefined || v === null) throw err(400, "body required");
  if (typeof v === "object" && !Array.isArray(v)) {
    const en = v.en;
    let hasEn = false;
    let out = {};
    if (en !== undefined && en !== null) {
      if (typeof en !== "string") throw err(400, "body.en must be string");
      const t = en.trim();
      if (t.length > 0) {
        if (t.length < 10 || t.length > 6000) throw err(400, "body.en must be 10-6000 characters");
        out.en = t;
        hasEn = true;
      }
    }
    let ne;
    if (v.ne !== undefined && v.ne !== null) {
      if (typeof v.ne !== "string") throw err(400, "body.ne must be string");
      const t = v.ne.trim();
      if (t.length > 0) {
        if (t.length < 10 || t.length > 6000) throw err(400, "body.ne must be 10-6000 characters");
        ne = t;
      }
    }
    if (ne !== undefined) out.ne = ne;
    if (!hasEn && ne === undefined) {
      // allow either en or ne, but at least one required
      throw err(400, "body.en or body.ne required");
    }
    return out;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (t.length < 10 || t.length > 6000) throw err(400, "body must be 10-6000 characters");
    return { __single: t };
  }
  throw err(400, "body must be string or object");
}

const ARTICLE_TEXT_TYPES = ["paragraph", "heading", "quote"];
const ARTICLE_MEDIA_TYPES = ["image", "video"];

function articleString(v, name, max, { required = false, trim = false } = {}) {
  if (v === undefined || v === null) {
    if (required) throw err(400, `${name} required`);
    return undefined;
  }
  if (typeof v !== "string") throw err(400, `${name} must be string`);
  const value = trim ? v.trim() : v;
  if (required && !value.trim()) throw err(400, `${name} required`);
  if (value.length > max) throw err(400, `${name} must be at most ${max} characters`);
  return value;
}

export function validateArticleUrl(url, name, mediaPublicBase) {
  const value = articleString(url, name, 2000, { trim: true }) ?? "";
  if (value && !/^https:\/\//.test(value)) throw err(400, `${name} must be an https URL`);
  if (mediaPublicBase && value && !value.startsWith(String(mediaPublicBase).replace(/\/+$/, "") + "/")) {
    throw err(400, `${name} must use the configured media public base`);
  }
  return value;
}

/** Validates article blocks for PUT. Empty fields are allowed while an upload/editor is in progress. */
export function validateArticleBlocks(value, { mediaPublicBase } = {}) {
  if (!Array.isArray(value)) throw err(400, "blocks must be array");
  if (value.length > 60) throw err(400, "blocks must be at most 60");
  return value.map((block, index) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) throw err(400, `block ${index} must be object`);
    if (![...ARTICLE_TEXT_TYPES, ...ARTICLE_MEDIA_TYPES].includes(block.type)) throw err(400, `block ${index} has invalid type`);
    if (ARTICLE_TEXT_TYPES.includes(block.type)) {
      const text = articleString(block.text, `block ${index}.text`, 5000) ?? "";
      return { type: block.type, text };
    }
    const out = { type: block.type };
    if (block.url !== undefined) out.url = validateArticleUrl(block.url, `block ${index}.url`, mediaPublicBase);
    else out.url = "";
    out.fileId = articleString(block.fileId, `block ${index}.fileId`, 200, { trim: true }) ?? "";
    out.source = articleString(block.source, `block ${index}.source`, 200, { trim: true }) ?? "";
    if (block.caption !== undefined && block.caption !== null) out.caption = articleString(block.caption, `block ${index}.caption`, 300) ?? "";
    return out;
  });
}

/** Validates an optional cover for PUT. A null cover is handled by the caller as a clear operation. */
export function validateArticleCover(value, { mediaPublicBase } = {}) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) throw err(400, "cover must be object");
  const out = {
    url: value.url === undefined ? "" : validateArticleUrl(value.url, "cover.url", mediaPublicBase),
    fileId: articleString(value.fileId, "cover.fileId", 200, { trim: true }) ?? "",
    source: articleString(value.source, "cover.source", 200, { trim: true }) ?? "",
  };
  if (value.caption !== undefined && value.caption !== null) out.caption = articleString(value.caption, "cover.caption", 300) ?? "";
  return out;
}

export function validateArticleTags(value, { strict = false } = {}) {
  if (!Array.isArray(value)) throw err(400, "tags must be array");
  if ((strict && (value.length < 1 || value.length > 3)) || (!strict && value.length > 3)) throw err(400, "tags must have 1-3 entries");
  if (value.some((tag) => typeof tag !== "string" || !DISPATCH_TAGS.includes(tag))) throw err(400, "tags contains an invalid tag");
  if (new Set(value).size !== value.length) throw err(400, "tags must be unique");
  return [...value];
}

export function validateArticleTitle(value, { strict = false } = {}) {
  if (typeof value !== "string") {
    if (strict) throw err(400, "title required");
    throw err(400, "title must be string");
  }
  const title = value.trim();
  if (title.length > 200 || (strict && !title)) throw err(400, "title must be 1-200 characters");
  return title;
}
