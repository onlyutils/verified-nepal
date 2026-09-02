import { json, err, getQuery, parseBody, encodeCursor, decodeCursor } from "../lib/http.js";
import { validateString, validatePhone, validateOptionalEmail, validateDistrict } from "../lib/validate.js";
import { requireAuth } from "../lib/auth.js";
import { CATEGORIES } from "../constants.js";
import { createOffer, listPublicOffers } from "../models/offer.js";
import { toPublicOfferListItem } from "../views/offer.js";

export async function handlePostOffers(event, { fetchJwks, getDdb, env }) {
  const auth = await requireAuth(event, { fetchJwks, getDdb, env });
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { org, categories, districts, description, phone, email } = body;
  if (!Array.isArray(categories) || categories.length === 0) throw err(400, "categories must be non-empty array");
  if (categories.length > 20) throw err(400, "categories must be at most 20");
  for (const c of categories) if (!CATEGORIES.includes(c)) throw err(400, `invalid category ${c}`);
  const cleanCategories = Array.from(new Set(categories));
  if (!Array.isArray(districts) || districts.length === 0) throw err(400, "districts must be non-empty array");
  if (districts.length > 20) throw err(400, "districts must be at most 20");
  const cleanDistricts = Array.from(new Set(districts.map((d) => validateDistrict(d, "districts[]"))));
  const desc = validateString(description, "description", 10, 2000);
  const cleanPhone = validatePhone(phone, "phone");
  const cleanEmail = validateOptionalEmail(email, "email");
  let cleanOrg;
  if (org !== undefined && org !== null) {
    if (typeof org !== "object") throw err(400, "org must be object");
    const name = validateString(org.name, "org.name", 1, 100);
    const contact = validateString(org.contact, "org.contact", 1, 200);
    cleanOrg = { name, contact };
  }
  const helperSub = auth.payload.sub;
  const helperName = auth.user?.name || auth.payload.name || "Helper";
  const { id } = await createOffer(auth.ddb, auth.tableName, {
    helperSub, helperName, org: cleanOrg, categories: cleanCategories, districts: cleanDistricts,
    description: desc, phone: cleanPhone, email: cleanEmail,
  });
  return json(201, { id });
}

export async function handleGetOffers(event, { getDdb, env }) {
  const q = getQuery(event);
  const district = q.district ? String(q.district).trim() : "";
  const category = q.category ? String(q.category).trim() : "";
  const cursorRaw = q.cursor ? String(q.cursor) : "";
  if (category && !CATEGORIES.includes(category)) throw err(400, `category must be one of ${CATEGORIES.join(",")}`);
  const cursorKey = decodeCursor(cursorRaw);
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const items = await listPublicOffers(ddb, tableName, { district, category });
  let start = 0;
  if (cursorKey) {
    const idx = items.findIndex((it) => it.PK === cursorKey.PK && it.SK === cursorKey.SK);
    if (idx === -1) throw err(400, "invalid cursor");
    start = idx + 1;
  }
  const limit = 20;
  const sliced = items.slice(start, start + limit);
  const publicItems = sliced.map(toPublicOfferListItem);
  const body = { items: publicItems };
  if (start + limit < items.length) {
    const last = sliced[sliced.length - 1];
    body.cursor = encodeCursor({ PK: last.PK, SK: last.SK });
  }
  return json(200, body);
}
