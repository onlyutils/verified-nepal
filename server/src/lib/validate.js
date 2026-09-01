import { err } from "./http.js";

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
