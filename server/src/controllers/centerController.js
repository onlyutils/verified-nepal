import { randomUUID } from "node:crypto";
import { json, err, getQuery, parseBody, encodeCursor, decodeCursor, getAuthToken } from "../lib/http.js";
import { requireAuth, requireModAuth } from "../lib/auth.js";
import { validateString, validatePhone } from "../lib/validate.js";
import { isGoodsCategory, unitFor } from "../lib/goods-taxonomy.js";
import { getOrg, getMembership } from "../models/org.js";
import { getCenter, saveCenter, listCentersByDistrict, listPublicCenters, centerVisibility, listFlaggedCenterPointers, listCenterFlags } from "../models/center.js";
import { putEntry, listEntries, listAllEntries, listDistrictEntries, computeStock, deltaFor, getEntryById, putTransferMeta, getTransferMeta, putInbound, deleteInbound, listInbound } from "../models/goods.js";
import { getDonation, listCenterDonationsRaw } from "../models/donation.js";
import { recordAudit } from "../models/audit.js";
import { toPublicCenterView, toPrivateCenterView } from "../views/center.js";
import { toPublicEntryView, toPrivateEntryView } from "../views/goods.js";
import { toPublicDonationView } from "../views/donation.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { generateRefCode } from "../lib/format.js";
import { GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

function validateCenterUpdateBody(body) {
  const out = {};
  if (body.name !== undefined) out.name = validateString(body.name, "name", 1, 100);
  if (body.district !== undefined) out.district = validateString(body.district, "district", 1, 100);
  if (body.ward !== undefined) {
    const w = body.ward;
    if (typeof w !== "number" || !Number.isInteger(w)) throw err(400, "ward must be integer");
    if (w < 1 || w > 33) throw err(400, "ward must be 1-33");
    out.ward = w;
  }
  if (body.address !== undefined) out.address = validateString(body.address, "address", 1, 300);
  const hasLat = body.lat !== undefined && body.lat !== null;
  const hasLng = body.lng !== undefined && body.lng !== null;
  if (hasLat !== hasLng) throw err(400, "lat and lng must both be provided or neither");
  if (hasLat && hasLng) {
    const lat = body.lat;
    const lng = body.lng;
    if (typeof lat !== "number" || !Number.isFinite(lat)) throw err(400, "lat must be number");
    if (typeof lng !== "number" || !Number.isFinite(lng)) throw err(400, "lng must be number");
    if (lat < 26 || lat > 31) throw err(400, "lat must be 26-31");
    if (lng < 80 || lng > 89) throw err(400, "lng must be 80-89");
    out.lat = lat;
    out.lng = lng;
  }
  // allow clearing lat/lng? spec says both or neither, but update could send null? handle
  if (body.hours !== undefined) {
    if (body.hours === null || body.hours === "") out.hours = undefined;
    else out.hours = validateString(body.hours, "hours", 1, 200);
  }
  if (body.contactPhone !== undefined) out.contactPhone = validatePhone(body.contactPhone, "contactPhone");
  if (body.accepts !== undefined) {
    const a = body.accepts;
    if (!Array.isArray(a)) throw err(400, "accepts must be array");
    if (a.length > 20) throw err(400, "accepts must be at most 20");
    const seen = new Set();
    for (const cat of a) {
      if (typeof cat !== "string") throw err(400, "accepts must be strings");
      const c = cat.trim();
      if (!isGoodsCategory(c)) throw err(400, `accepts contains invalid category: ${c}`);
      if (seen.has(c)) throw err(400, "accepts must be unique");
      seen.add(c);
    }
    out.accepts = Array.from(seen);
  }
  if (body.notes !== undefined) {
    if (body.notes === null || body.notes === "") out.notes = undefined;
    else out.notes = validateString(body.notes, "notes", 1, 500);
  }
  if (body.status !== undefined) {
    const s = String(body.status).trim();
    if (!["open", "paused", "closed"].includes(s)) throw err(400, "status must be open|paused|closed");
    out.status = s;
  }
  return out;
}

async function getOptionalAuth(event, opts) {
  const token = getAuthToken(event.headers);
  if (!token) return null;
  try {
    const auth = await requireAuth(event, opts);
    return auth;
  } catch (e) {
    if (e.status === 401) return null;
    throw e;
  }
}

async function isMemberOrMod(auth, center) {
  if (!auth) return false;
  if (["moderator", "admin"].includes(auth.role)) return true;
  const mem = await getMembership(auth.ddb, auth.tableName, auth.payload.sub, center.orgId);
  return !!mem;
}

export async function handleListCenters(event, opts) {
  const q = getQuery(event);
  const district = q.district ? String(q.district).trim() : "";
  const cursorRaw = q.cursor ? String(q.cursor).trim() : "";
  const cursorKey = decodeCursor(cursorRaw);
  if (district) {
    const res = await listCentersByDistrict(opts.getDdb(), opts.env.TABLE_NAME, district, cursorKey);
    // filter visibility public
    const publicItems = (res.Items || []).filter((c) => c.visibility === "public");
    const items = publicItems.map(toPublicCenterView);
    const body = { items };
    if (res.LastEvaluatedKey) body.cursor = encodeCursor(res.LastEvaluatedKey);
    // Note: if filtered items less than page but there are more, we still return cursor for pagination
    // Filtering after query is okay for spec; we return cursor as from DB.
    // However if filtered empty but more exist, next page will show.
    return json(200, body);
  } else {
    const res = await listPublicCenters(opts.getDdb(), opts.env.TABLE_NAME, cursorKey);
    const items = (res.Items || []).map(toPublicCenterView);
    const body = { items };
    if (res.LastEvaluatedKey) body.cursor = encodeCursor(res.LastEvaluatedKey);
    return json(200, body);
  }
}

export async function handleGetCenter(event, opts, centerId) {
  const ddb = opts.getDdb();
  const tableName = opts.env.TABLE_NAME;
  const center = await getCenter(ddb, tableName, centerId);
  if (!center) throw err(404, "not found");
  const auth = await getOptionalAuth(event, opts);
  const canSeeHidden = await isMemberOrMod(auth, center);
  if (center.visibility !== "public" && !canSeeHidden) throw err(404, "not found");
  const entries = await listAllEntries(ddb, tableName, centerId);
  const stock = computeStock(entries);
  // recent last 20 newest first already via entries sorted? listAllEntries returns in order queried (PK query sorted by SK asc then reversed? Actually Query ScanIndexForward false gives newest first)
  // listAllEntries collects in that order, so slicing 0..20 gives newest
  const recentEntries = entries.slice(0, 20);
  const recent = recentEntries.map((e) => {
    if (canSeeHidden) return toPrivateEntryView(e);
    return toPublicEntryView(e);
  });
  const base = canSeeHidden ? toPrivateCenterView(center) : toPublicCenterView(center);
  base.stock = stock;
  base.recent = recent;
  return json(200, base);
}

export async function handleUpdateCenter(event, opts, centerId) {
  const auth = await requireAuth(event, opts);
  const ddb = auth.ddb;
  const tableName = auth.tableName;
  const center = await getCenter(ddb, tableName, centerId);
  if (!center) throw err(404, "not found");
  const mem = await getMembership(ddb, tableName, auth.payload.sub, center.orgId);
  if (!mem || mem.role !== "owner") throw err(403, "Forbidden");
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const validated = validateCenterUpdateBody(body);
  const keys = Object.keys(validated);
  if (keys.length === 0) throw err(400, "no fields to update");
  const oldDistrict = center.district;
  const now = new Date().toISOString();
  for (const k of keys) {
    if (validated[k] === undefined) delete center[k];
    else center[k] = validated[k];
  }
  // district change updates gsi1pk
  if (validated.district && validated.district !== oldDistrict) {
    center.gsi1pk = `CENTER#${validated.district}`;
  }
  // status or orgStatus change affects visibility
  if (validated.status) {
    center.visibility = centerVisibility(center.orgStatus, validated.status);
    center.gsi2pk = `CENTER#${center.visibility}`;
  }
  center.updatedAt = now;
  center.gsi1sk = center.createdAt;
  center.gsi2sk = center.createdAt;
  await saveCenter(ddb, tableName, center);
  const actorName = auth.user?.name || auth.payload.name || "";
  await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "center.update", targetType: "CENTER", targetId: centerId, targetLabel: center.name });
  return json(200, { ok: true });
}

export async function handleGetStock(event, opts, centerId) {
  const ddb = opts.getDdb();
  const tableName = opts.env.TABLE_NAME;
  const center = await getCenter(ddb, tableName, centerId);
  if (!center) throw err(404, "not found");
  // stock is public even for hidden? but hidden centers are 404 for anonymous get? stock endpoint likely same rule but task doesn't mention. For now allow public stock even if hidden? But spec says public can see stock; hidden centers are not visible. Let's enforce same visibility check for anonymous
  const auth = await getOptionalAuth(event, opts);
  const canSeeHidden = await isMemberOrMod(auth, center);
  if (center.visibility !== "public" && !canSeeHidden) throw err(404, "not found");
  const entries = await listAllEntries(ddb, tableName, centerId);
  const stock = computeStock(entries);
  return json(200, { items: stock });
}

export async function handleListEntries(event, opts, centerId) {
  const ddb = opts.getDdb();
  const tableName = opts.env.TABLE_NAME;
  const center = await getCenter(ddb, tableName, centerId);
  if (!center) throw err(404, "not found");
  const q = getQuery(event);
  const cursorRaw = q.cursor ? String(q.cursor).trim() : "";
  const cursorKey = decodeCursor(cursorRaw);
  const auth = await getOptionalAuth(event, opts);
  const canSeePrivate = await isMemberOrMod(auth, center);
  if (center.visibility !== "public" && !canSeePrivate) throw err(404, "not found");
  const res = await listEntries(ddb, tableName, centerId, cursorKey, 50);
  const items = (res.Items || []).map((e) => (canSeePrivate ? toPrivateEntryView(e) : toPublicEntryView(e)));
  const body = { items };
  if (res.LastEvaluatedKey) body.cursor = encodeCursor(res.LastEvaluatedKey);
  return json(200, body);
}

export async function handleCreateEntry(event, opts, centerId) {
  const auth = await requireAuth(event, opts);
  const ddb = auth.ddb;
  const tableName = auth.tableName;
  const center = await getCenter(ddb, tableName, centerId);
  if (!center) throw err(404, "not found");
  const mem = await getMembership(ddb, tableName, auth.payload.sub, center.orgId);
  if (!mem) {
    if (!["moderator", "admin"].includes(auth.role)) throw err(403, "Forbidden");
    throw err(403, "Forbidden");
  }
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const entryType = body.entryType ? String(body.entryType).trim() : "";
  if (entryType === "intake" || entryType === "distribution") {
    const category = body.category ? String(body.category).trim() : "";
    if (!isGoodsCategory(category)) throw err(400, "invalid category");
    const qtyRaw = body.qty;
    if (qtyRaw === undefined || qtyRaw === null) throw err(400, "qty required");
    if (typeof qtyRaw !== "number") throw err(400, "qty must be a number");
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1000000) throw err(400, "qty must be >0 and <=1000000");
    const rounded = Math.round(qty * 100) / 100;
    if (rounded !== qty) throw err(400, "qty must have at most 2 decimals");
    let note;
    if (body.note !== undefined && body.note !== null && String(body.note).trim() !== "") {
      note = validateString(body.note, "note", 1, 500);
    }
    if (entryType === "distribution") {
      const all = await listAllEntries(ddb, tableName, centerId);
      const stock = computeStock(all);
      const found = stock.find((s) => s.category === category);
      const available = found ? found.qty : 0;
      if (qty > available) throw err(400, "insufficient stock");
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    const unit = unitFor(category);
    const delta = deltaFor(entryType, qty);
    const entry = {
      PK: `GOODS#${centerId}`,
      SK: `${now}#${id}`,
      type: "GOODS",
      id,
      centerId,
      orgId: center.orgId,
      district: center.district,
      entryType,
      category,
      unit,
      qty,
      delta,
      createdAt: now,
      createdBy: auth.payload.sub,
      createdByName: auth.user?.name || auth.payload.name || "",
      gsi1pk: `GOODS#${center.district}`,
      gsi1sk: now,
    };
    if (note !== undefined) entry.note = note;
    await putEntry(ddb, tableName, entry);
    const actorName = auth.user?.name || auth.payload.name || "";
    await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "entry.create", targetType: "GOODS", targetId: id, targetLabel: `${entryType} ${category} ${qty}` });
    return json(201, { id, unit, delta });
  }
  if (entryType === "transfer_out") {
    const category = body.category ? String(body.category).trim() : "";
    if (!isGoodsCategory(category)) throw err(400, "invalid category");
    const qtyRaw = body.qty;
    if (qtyRaw === undefined || qtyRaw === null) throw err(400, "qty required");
    if (typeof qtyRaw !== "number") throw err(400, "qty must be a number");
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1000000) throw err(400, "qty must be >0 and <=1000000");
    const rounded = Math.round(qty * 100) / 100;
    if (rounded !== qty) throw err(400, "qty must have at most 2 decimals");
    const destinationType = body.destinationType ? String(body.destinationType).trim() : "";
    if (!["center", "external"].includes(destinationType)) throw err(400, "destinationType must be center|external");
    let note;
    if (body.note !== undefined && body.note !== null && String(body.note).trim() !== "") {
      note = validateString(body.note, "note", 1, 500);
    }
    let destinationCenterId;
    let destinationLabel;
    if (destinationType === "center") {
      const destIdRaw = body.destinationCenterId ? String(body.destinationCenterId).trim() : "";
      if (!destIdRaw) throw err(400, "destinationCenterId required");
      if (destIdRaw === centerId) throw err(400, "cannot transfer to self");
      const destCenter = await getCenter(ddb, tableName, destIdRaw);
      if (!destCenter || destCenter.visibility !== "public") throw err(400, "destination must be a public center");
      destinationCenterId = destIdRaw;
      destinationLabel = destCenter.name;
    } else {
      const labelRaw = body.destinationLabel !== undefined && body.destinationLabel !== null ? String(body.destinationLabel).trim() : "";
      if (!labelRaw || labelRaw.length < 1 || labelRaw.length > 200) throw err(400, "destinationLabel must be 1-200 characters");
      destinationLabel = labelRaw;
    }
    const all = await listAllEntries(ddb, tableName, centerId);
    const stock = computeStock(all);
    const found = stock.find((s) => s.category === category);
    const available = found ? found.qty : 0;
    if (qty > available) throw err(400, "insufficient stock");
    const id = randomUUID();
    const transferId = randomUUID();
    const now = new Date().toISOString();
    const unit = unitFor(category);
    const delta = deltaFor("transfer_out", qty);
    const transferStatus = destinationType === "center" ? "in_transit" : "sent";
    const entry = {
      PK: `GOODS#${centerId}`,
      SK: `${now}#${id}`,
      type: "GOODS",
      id,
      centerId,
      orgId: center.orgId,
      district: center.district,
      entryType: "transfer_out",
      category,
      unit,
      qty,
      delta,
      createdAt: now,
      createdBy: auth.payload.sub,
      createdByName: auth.user?.name || auth.payload.name || "",
      gsi1pk: `GOODS#${center.district}`,
      gsi1sk: now,
      transferId,
      transferStatus,
      destinationType,
      destinationLabel,
    };
    if (destinationCenterId) entry.destinationCenterId = destinationCenterId;
    if (note !== undefined) entry.note = note;
    await putEntry(ddb, tableName, entry);
    const meta = {
      PK: `TRANSFER#${transferId}`,
      SK: "META",
      type: "TRANSFER",
      transferId,
      fromCenterId: centerId,
      fromCenterName: center.name,
      toCenterId: destinationCenterId || null,
      entryId: id,
      category,
      unit,
      qty,
      status: transferStatus,
      createdAt: now,
    };
    await putTransferMeta(ddb, tableName, meta);
    if (destinationType === "center") {
      const inbound = {
        PK: `CENTER#${destinationCenterId}`,
        SK: `INBOUND#${transferId}`,
        type: "INBOUND",
        transferId,
        fromCenterId: centerId,
        fromCenterName: center.name,
        category,
        unit,
        qty,
        entryId: id,
        createdAt: now,
      };
      await putInbound(ddb, tableName, destinationCenterId, inbound);
    }
    const actorName = auth.user?.name || auth.payload.name || "";
    await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "entry.create", targetType: "GOODS", targetId: id, targetLabel: `transfer_out ${category} ${qty}` });
    return json(201, { id, transferId });
  }
  if (entryType === "correction") {
    const correctsEntryId = body.correctsEntryId ? String(body.correctsEntryId).trim() : "";
    if (!correctsEntryId) throw err(400, "correctsEntryId required");
    const noteRaw = body.note !== undefined && body.note !== null ? String(body.note).trim() : "";
    if (noteRaw.length < 3 || noteRaw.length > 500) throw err(400, "note must be 3-500 characters");
    const note = noteRaw;
    const original = await getEntryById(ddb, tableName, correctsEntryId);
    if (!original) throw err(400, "original entry not found");
    if (original.centerId !== centerId) throw err(400, "original does not belong to this center");
    if (original.correctedByEntryId) throw err(400, "already corrected");
    if (original.entryType === "transfer_in") throw err(400, "cannot correct a completed transfer");
    if (original.entryType === "transfer_out" && original.transferStatus === "received") throw err(400, "cannot correct a completed transfer");
    const id = randomUUID();
    const now = new Date().toISOString();
    const category = original.category;
    const unit = original.unit;
    const qty = original.qty;
    const delta = -original.delta;
    const entry = {
      PK: `GOODS#${centerId}`,
      SK: `${now}#${id}`,
      type: "GOODS",
      id,
      centerId,
      orgId: center.orgId,
      district: center.district,
      entryType: "correction",
      category,
      unit,
      qty,
      delta,
      correctsEntryId,
      note,
      createdAt: now,
      createdBy: auth.payload.sub,
      createdByName: auth.user?.name || auth.payload.name || "",
      gsi1pk: `GOODS#${center.district}`,
      gsi1sk: now,
    };
    await putEntry(ddb, tableName, entry);
    original.correctedByEntryId = id;
    await ddb.send(new PutCommand({ TableName: tableName, Item: original }));
    const actorName = auth.user?.name || auth.payload.name || "";
    await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "entry.correction", targetType: "GOODS", targetId: id, targetLabel: `correction ${category} ${qty}` });
    return json(201, { id });
  }
  throw err(400, "unsupported entryType");
}

export async function handleGoodsLedger(event, opts) {
  const q = getQuery(event);
  const district = q.district ? String(q.district).trim() : "";
  if (!district) throw err(400, "district required");
  const cursorRaw = q.cursor ? String(q.cursor).trim() : "";
  const cursorKey = decodeCursor(cursorRaw);
  const ddb = opts.getDdb();
  const tableName = opts.env.TABLE_NAME;
  const res = await listDistrictEntries(ddb, tableName, district, cursorKey);
  // Only surface entries whose center is currently publicly visible: a rejected/
  // suspended org (or closed center) is hidden everywhere else, so its activity
  // must not remain public here. visibility is a stored, status-refreshed field.
  const visCache = new Map();
  const items = [];
  for (const e of (res.Items || [])) {
    let vis = visCache.get(e.centerId);
    if (vis === undefined) {
      const c = await getCenter(ddb, tableName, e.centerId);
      vis = c && c.visibility ? c.visibility : "hidden";
      visCache.set(e.centerId, vis);
    }
    if (vis === "public") items.push(toPublicEntryView(e));
  }
  const body = { items };
  if (res.LastEvaluatedKey) body.cursor = encodeCursor(res.LastEvaluatedKey);
  return json(200, body);
}

export async function handleInbound(event, opts, centerId) {
  const auth = await requireAuth(event, opts);
  const ddb = auth.ddb;
  const tableName = auth.tableName;
  const center = await getCenter(ddb, tableName, centerId);
  if (!center) throw err(404, "not found");
  const mem = await getMembership(ddb, tableName, auth.payload.sub, center.orgId);
  if (!mem) throw err(403, "Forbidden");
  const items = await listInbound(ddb, tableName, centerId);
  const out = items.map((it) => ({
    transferId: it.transferId,
    fromCenterId: it.fromCenterId,
    fromCenterName: it.fromCenterName,
    category: it.category,
    unit: it.unit,
    qty: it.qty,
    entryId: it.entryId,
    createdAt: it.createdAt,
  }));
  return json(200, { items: out });
}

export async function handleReceive(event, opts, transferId) {
  const auth = await requireAuth(event, opts);
  const ddb = auth.ddb;
  const tableName = auth.tableName;
  const meta = await getTransferMeta(ddb, tableName, transferId);
  if (!meta) throw err(404, "not found");
  if (meta.status === "received") throw err(400, "already received");
  const toCenterId = meta.toCenterId;
  if (!toCenterId) throw err(404, "not found");
  const destCenter = await getCenter(ddb, tableName, toCenterId);
  if (!destCenter) throw err(404, "not found");
  const mem = await getMembership(ddb, tableName, auth.payload.sub, destCenter.orgId);
  if (!mem) throw err(403, "Forbidden");
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const qtyReceivedRaw = body.qtyReceived;
  if (qtyReceivedRaw === undefined || qtyReceivedRaw === null) throw err(400, "qtyReceived required");
  if (typeof qtyReceivedRaw !== "number") throw err(400, "qtyReceived must be a number");
  const qtyReceived = Number(qtyReceivedRaw);
  if (!Number.isFinite(qtyReceived) || qtyReceived < 0 || qtyReceived > 1000000) throw err(400, "qtyReceived must be >=0 and <=1000000");
  const rounded = Math.round(qtyReceived * 100) / 100;
  if (rounded !== qtyReceived) throw err(400, "qtyReceived must have at most 2 decimals");
  let note;
  if (body.note !== undefined && body.note !== null && String(body.note).trim() !== "") {
    note = validateString(body.note, "note", 1, 500);
  }
  // Atomic mutex: delete the inbound pointer conditionally. Two concurrent receives
  // race here; only one delete succeeds, the other gets ConditionalCheckFailed and is
  // rejected — preventing a double credit. Also serves as the existence check.
  try {
    await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `CENTER#${toCenterId}`, SK: `INBOUND#${transferId}` }, ConditionExpression: "attribute_exists(PK)" }));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") throw err(400, "already received");
    throw e;
  }
  const sourceEntry = await getEntryById(ddb, tableName, meta.entryId);
  if (!sourceEntry) throw err(404, "not found");
  if (sourceEntry.transferStatus === "received") throw err(400, "already received");
  const now = new Date().toISOString();
  const id = randomUUID();
  if (qtyReceived > meta.qty) throw err(400, "qty_exceeds_sent");
  const discrepancy = Math.round((meta.qty - qtyReceived) * 100) / 100;
  const entry = {
    PK: `GOODS#${toCenterId}`,
    SK: `${now}#${id}`,
    type: "GOODS",
    id,
    centerId: toCenterId,
    orgId: destCenter.orgId,
    district: destCenter.district,
    entryType: "transfer_in",
    category: meta.category,
    unit: meta.unit,
    qty: qtyReceived,
    delta: qtyReceived,
    transferId,
    sourceCenterId: meta.fromCenterId,
    sourceLabel: meta.fromCenterName,
    transferStatus: "received",
    createdAt: now,
    createdBy: auth.payload.sub,
    createdByName: auth.user?.name || auth.payload.name || "",
    gsi1pk: `GOODS#${destCenter.district}`,
    gsi1sk: now,
    qtyReceived,
  };
  if (note !== undefined) entry.note = note;
  if (discrepancy !== 0) {
    entry.discrepancy = discrepancy;
    entry.qtyReceived = qtyReceived;
  }
  await putEntry(ddb, tableName, entry);
  sourceEntry.transferStatus = "received";
  sourceEntry.qtyReceived = qtyReceived;
  if (discrepancy !== 0) sourceEntry.discrepancy = discrepancy;
  else delete sourceEntry.discrepancy;
  await ddb.send(new PutCommand({ TableName: tableName, Item: sourceEntry }));
  meta.status = "received";
  meta.qtyReceived = qtyReceived;
  if (discrepancy !== 0) meta.discrepancy = discrepancy;
  await putTransferMeta(ddb, tableName, meta);
  const actorName = auth.user?.name || auth.payload.name || "";
  await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "transfer.receive", targetType: "GOODS", targetId: id, targetLabel: `transfer_in ${meta.category} ${qtyReceived}` });
  return json(201, { id });
}


async function createEntryForCenter({ ddb, tableName, center, auth, entryType, category, qty, note, donationRef }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const unit = unitFor(category);
  const delta = deltaFor(entryType, qty);
  const entry = {
    PK: `GOODS#${center.id}`,
    SK: `${now}#${id}`,
    type: "GOODS",
    id,
    centerId: center.id,
    orgId: center.orgId,
    district: center.district,
    entryType,
    category,
    unit,
    qty,
    delta,
    createdAt: now,
    createdBy: auth.payload.sub,
    createdByName: auth.user?.name || auth.payload.name || "",
    gsi1pk: `GOODS#${center.district}`,
    gsi1sk: now,
  };
  if (note !== undefined) entry.note = note;
  if (donationRef !== undefined) entry.donationRef = donationRef;
  await putEntry(ddb, tableName, entry);
  const actorName = auth.user?.name || auth.payload.name || "";
  await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "entry.create", targetType: "GOODS", targetId: id, targetLabel: `${entryType} ${category} ${qty}` });
  return { id, entry, now };
}

export async function handleCreateDonation(event, opts, centerId) {
  const ddb = opts.getDdb();
  const tableName = opts.env.TABLE_NAME;
  const center = await getCenter(ddb, tableName, centerId);
  if (!center || center.visibility !== "public") throw err(404, "not found");
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const categoryRaw = body.category ? String(body.category).trim() : "";
  if (!isGoodsCategory(categoryRaw)) throw err(400, "invalid category");
  const category = categoryRaw;
  const qtyRaw = body.qty;
  if (qtyRaw === undefined || qtyRaw === null) throw err(400, "qty required");
  const qty = Number(qtyRaw);
  if (!Number.isFinite(qty) || qty <= 0 || qty > 1000000) throw err(400, "qty must be >0 and <=1000000");
  const rounded = Math.round(qty * 100) / 100;
  if (rounded !== qty) throw err(400, "qty must have at most 2 decimals");
  let note;
  if (body.note !== undefined && body.note !== null && String(body.note).trim() !== "") {
    note = validateString(body.note, "note", 1, 500);
  }
  await verifyTurnstile(body.turnstileToken, opts.env.TURNSTILE_SECRET);
  let ref = generateRefCode();
  let tries = 0;
  while (tries < 3) {
    const existing = await getDonation(ddb, tableName, ref);
    if (!existing) break;
    ref = generateRefCode();
    tries++;
  }
  const now = new Date().toISOString();
  const unit = unitFor(category);
  const donation = {
    PK: `DONATION#${ref}`,
    SK: "META",
    type: "DONATION",
    ref,
    centerId,
    centerName: center.name,
    orgId: center.orgId,
    district: center.district,
    category,
    unit,
    qty,
    status: "declared",
    declaredAt: now,
  };
  if (note !== undefined) donation.note = note;
  const pointer = {
    PK: `CENTER#${centerId}`,
    SK: `DONATION#${now}#${ref}`,
    type: "DONATION",
    ref,
    centerId,
    centerName: center.name,
    orgId: center.orgId,
    district: center.district,
    category,
    unit,
    qty,
    status: "declared",
    declaredAt: now,
  };
  if (note !== undefined) pointer.note = note;
  await ddb.send(new PutCommand({ TableName: tableName, Item: donation }));
  await ddb.send(new PutCommand({ TableName: tableName, Item: pointer }));
  return json(201, { ref });
}

export async function handleGetDonation(event, opts, ref) {
  const ddb = opts.getDdb();
  const tableName = opts.env.TABLE_NAME;
  const donation = await getDonation(ddb, tableName, ref);
  if (!donation) throw err(404, "not found");
  const out = {
    ref: donation.ref,
    center: { id: donation.centerId, name: donation.centerName, district: donation.district },
    category: donation.category,
    unit: donation.unit,
    qty: donation.qty,
    status: donation.status,
    declaredAt: donation.declaredAt,
  };
  if (donation.note !== undefined) out.note = donation.note;
  if (donation.receivedAt !== undefined) out.receivedAt = donation.receivedAt;
  if (donation.status === "received" && donation.receivedAt) {
    let threshold = donation.receivedAt;
    let excludeId = donation.intakeEntryId;
    if (donation.intakeEntryId) {
      try {
        const intake = await getEntryById(ddb, tableName, donation.intakeEntryId);
        if (intake && intake.createdAt) threshold = intake.createdAt;
      } catch {}
    }
    const all = await listAllEntries(ddb, tableName, donation.centerId);
    let distributed = 0;
    let transferred = 0;
    for (const e of all) {
      if (e.correctedByEntryId) continue;
      if (excludeId && e.id === excludeId) continue;
      if (e.category !== donation.category) continue;
      if (e.createdAt < threshold) continue;
      if (e.createdAt === threshold) {
        // if threshold is intake entry createdAt, we already excluded intake itself, but other entries at same ms? include them
      }
      if (e.entryType === "distribution") {
        distributed += e.qty;
      } else if (e.entryType === "transfer_out") {
        transferred += e.qty;
      }
    }
    distributed = Math.round(distributed * 100) / 100;
    transferred = Math.round(transferred * 100) / 100;
    out.sinceReceived = { distributed, transferred };
  }
  return json(200, out);
}

export async function handleListDonations(event, opts, centerId) {
  const auth = await requireAuth(event, opts);
  const ddb = auth.ddb;
  const tableName = auth.tableName;
  const center = await getCenter(ddb, tableName, centerId);
  if (!center) throw err(404, "not found");
  const mem = await getMembership(ddb, tableName, auth.payload.sub, center.orgId);
  if (!mem) throw err(403, "Forbidden");
  const q = getQuery(event);
  const statusRaw = q.status ? String(q.status).trim() : "declared";
  const allowed = ["declared", "received", "not_received"];
  const filterStatus = allowed.includes(statusRaw) ? statusRaw : "declared";
  const raw = await listCenterDonationsRaw(ddb, tableName, centerId);
  const filtered = raw.filter((it) => it.status === filterStatus);
  filtered.sort((a, b) => (b.declaredAt || "").localeCompare(a.declaredAt || ""));
  const items = filtered.map((d) => {
    const view = {
      ref: d.ref,
      center: { id: d.centerId, name: d.centerName, district: d.district },
      category: d.category,
      unit: d.unit,
      qty: d.qty,
      status: d.status,
      declaredAt: d.declaredAt,
    };
    if (d.note !== undefined) view.note = d.note;
    if (d.receivedAt !== undefined) view.receivedAt = d.receivedAt;
    return view;
  });
  return json(200, { items });
}

export async function handleConfirmDonation(event, opts, ref) {
  const auth = await requireAuth(event, opts);
  const ddb = auth.ddb;
  const tableName = auth.tableName;
  const donation = await getDonation(ddb, tableName, ref);
  if (!donation) throw err(404, "not found");
  const center = await getCenter(ddb, tableName, donation.centerId);
  if (!center) throw err(404, "not found");
  const mem = await getMembership(ddb, tableName, auth.payload.sub, center.orgId);
  if (!mem) throw err(403, "Forbidden");
  if (donation.status !== "declared") throw err(400, "already confirmed");
  const body = parseBody(event);
  if (body && typeof body === "object" && body.action === "not_received") {
    donation.status = "not_received";
    const pointerSK = `DONATION#${donation.declaredAt}#${ref}`;
    const ptrRes = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `CENTER#${donation.centerId}`, SK: pointerSK } }));
    let pointer = ptrRes.Item;
    if (pointer) {
      pointer.status = "not_received";
      await ddb.send(new PutCommand({ TableName: tableName, Item: pointer }));
    }
    await ddb.send(new PutCommand({ TableName: tableName, Item: donation }));
    const actorName = auth.user?.name || auth.payload.name || "";
    await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "donation.not_received", targetType: "DONATION", targetId: ref, targetLabel: `donation ${ref}` });
    return json(200, { ok: true });
  }
  let qty = donation.qty;
  if (body && typeof body === "object" && body.qty !== undefined && body.qty !== null) {
    const qtyRaw = body.qty;
    if (typeof qtyRaw !== "number") throw err(400, "qty must be a number");
    const q = Number(qtyRaw);
    if (!Number.isFinite(q) || q <= 0 || q > 1000000) throw err(400, "qty must be >0 and <=1000000");
    const rounded = Math.round(q * 100) / 100;
    if (rounded !== q) throw err(400, "qty must have at most 2 decimals");
    if (q > donation.qty) throw err(400, "qty_exceeds_declared");
    qty = q;
  }
  const category = donation.category;
  const note = `Donor drop ${ref}`;
  const res = await createEntryForCenter({ ddb, tableName, center, auth, entryType: "intake", category, qty, note, donationRef: ref });
  const now = res.now;
  donation.status = "received";
  donation.receivedAt = now;
  donation.intakeEntryId = res.id;
  const pointerSK = `DONATION#${donation.declaredAt}#${ref}`;
  const ptrRes = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `CENTER#${donation.centerId}`, SK: pointerSK } }));
  let pointer = ptrRes.Item;
  if (pointer) {
    pointer.status = "received";
    pointer.receivedAt = now;
    pointer.intakeEntryId = res.id;
    await ddb.send(new PutCommand({ TableName: tableName, Item: pointer }));
  }
  await ddb.send(new PutCommand({ TableName: tableName, Item: donation }));
  const actorName = auth.user?.name || auth.payload.name || "";
  await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "donation.confirm", targetType: "DONATION", targetId: ref, targetLabel: `donation ${ref}` });
  return json(201, { entryId: res.id });
}

export async function handleFlagCenter(event, opts, centerId) {
  const ddb = opts.getDdb();
  const tableName = opts.env.TABLE_NAME;
  const center = await getCenter(ddb, tableName, centerId);
  if (!center) throw err(404, "not found");
  if (center.visibility !== "public") throw err(404, "not found");
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const reason = body.reason ? String(body.reason).trim() : "";
  const allowed = ["not_real", "closed", "misuse", "other"];
  if (!allowed.includes(reason)) throw err(400, `reason must be one of ${allowed.join(",")}`);
  let details;
  if (body.details !== undefined && body.details !== null && String(body.details).trim() !== "") {
    const d = String(body.details).trim();
    if (d.length > 500) throw err(400, "details too long");
    details = d;
  } else if (body.details !== undefined && body.details !== null) {
    if (typeof body.details !== "string") throw err(400, "details must be string");
    if (String(body.details).length > 500) throw err(400, "details too long");
  }
  await verifyTurnstile(body.turnstileToken, opts.env.TURNSTILE_SECRET);
  const now = new Date().toISOString();
  const flag = {
    PK: `CENTER#${centerId}`,
    SK: `FLAG#${now}#${randomUUID().slice(0, 8)}`,
    type: "CENTERFLAG",
    centerId,
    reason,
    createdAt: now,
  };
  if (details !== undefined) flag.details = details;
  await ddb.send(new PutCommand({ TableName: tableName, Item: flag }));
  const pointer = {
    PK: "FLAGGED",
    SK: `CENTER#${centerId}`,
    type: "FLAGGED",
    centerId,
    updatedAt: now,
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: pointer }));
  await ddb.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: center.PK, SK: center.SK },
    UpdateExpression: "ADD flagCount :one",
    ExpressionAttributeValues: { ":one": 1 },
  }));
  return json(201, { ok: true });
}

export async function handleCenterFlags(event, opts) {
  const auth = await requireModAuth(event, opts);
  const ddb = auth.ddb;
  const tableName = auth.tableName;
  const pointers = await listFlaggedCenterPointers(ddb, tableName);
  const items = [];
  for (const p of pointers) {
    const cid = p.centerId || String(p.SK).replace(/^CENTER#/, "");
    const center = await getCenter(ddb, tableName, cid);
    if (!center) continue;
    const reasons = await listCenterFlags(ddb, tableName, cid);
    items.push({
      centerId: cid,
      name: center.name,
      district: center.district,
      orgName: center.orgName,
      flagCount: center.flagCount || reasons.length,
      reasons,
    });
  }
  return json(200, { items });
}
