import { randomUUID } from "node:crypto";
import { json, err, getQuery, parseBody } from "../lib/http.js";
import { requireAuth, requireModAuth } from "../lib/auth.js";
import { validateString, validateOptionalString, validatePhone, validateOptionalEmail } from "../lib/validate.js";
import { isGoodsCategory } from "../lib/goods-taxonomy.js";
import { createOrg, getOrg, saveOrg, listOrgsByStatus, putMembership, getMembership, listUserMemberships, listOrgMembers, countOwnedOrgs, deleteMembership, putInvite, getInviteForEmail, getInviteForOrg, listInvitesForEmail, listInvitesForOrg, deleteInvite } from "../models/org.js";
import { createCenter, getCenter, saveCenter, listOrgCenterPointers, centerVisibility, refreshCentersForOrg, listFlaggedCenterPointers, listCenterFlags } from "../models/center.js";
import { getEmailPointer } from "../models/user.js";
import { recordAudit } from "../models/audit.js";
import { toPrivateOrgView, toModerationOrgView, toMyOrgView } from "../views/org.js";
import { toPrivateCenterView } from "../views/center.js";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
const ORG_TYPES = ["ngo", "community", "company", "religious", "government", "other"];
const TIERS = ["known", "vouched", "self_declared"];

function validateOrgBody(body, isUpdate = false) {
  const out = {};
  if (!isUpdate || body.name !== undefined) {
    out.name = validateString(body.name, "name", 2, 150);
  }
  if (!isUpdate || body.orgType !== undefined) {
    const t = body.orgType ? String(body.orgType).trim() : "";
    if (!ORG_TYPES.includes(t)) throw err(400, "orgType must be one of ngo|community|company|religious|government|other");
    out.orgType = t;
  }
  if (body.registrationNumber !== undefined) {
    if (body.registrationNumber === null || body.registrationNumber === "") {
      out.registrationNumber = undefined;
    } else {
      const v = validateString(body.registrationNumber, "registrationNumber", 1, 100);
      out.registrationNumber = v;
    }
  }
  if (!isUpdate || body.contactName !== undefined) {
    out.contactName = validateString(body.contactName, "contactName", 1, 100);
  }
  if (!isUpdate || body.contactPhone !== undefined) {
    out.contactPhone = validatePhone(body.contactPhone, "contactPhone");
  }
  if (body.contactEmail !== undefined) {
    const v = validateOptionalEmail(body.contactEmail, "contactEmail");
    out.contactEmail = v;
  } else if (!isUpdate && body.contactEmail === undefined) {
    // optional, leave undefined
  }
  if (!isUpdate || body.districts !== undefined) {
    const d = body.districts;
    if (!Array.isArray(d)) throw err(400, "districts must be array");
    if (d.length < 1 || d.length > 10) throw err(400, "districts must be 1-10 items");
    out.districts = d.map((s) => validateString(s, "districts[]", 1, 100));
  }
  if (!isUpdate || body.description !== undefined) {
    out.description = validateString(body.description, "description", 10, 2000);
  }
  if (body.website !== undefined) {
    if (body.website === null || body.website === "") {
      out.website = undefined;
    } else {
      const w = validateString(body.website, "website", 1, 200);
      out.website = w;
    }
  }
  return out;
}

function validateCenterBody(body, isUpdate = false) {
  const out = {};
  if (!isUpdate || body.name !== undefined) {
    out.name = validateString(body.name, "name", 1, 100);
  }
  if (!isUpdate || body.district !== undefined) {
    out.district = validateString(body.district, "district", 1, 100);
  }
  if (body.ward !== undefined) {
    const w = body.ward;
    if (typeof w !== "number" || !Number.isInteger(w)) throw err(400, "ward must be integer");
    if (w < 1 || w > 33) throw err(400, "ward must be 1-33");
    out.ward = w;
  }
  if (!isUpdate || body.address !== undefined) {
    out.address = validateString(body.address, "address", 1, 300);
  }
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
  if (body.hours !== undefined) {
    if (body.hours === null || body.hours === "") {
      out.hours = undefined;
    } else {
      out.hours = validateString(body.hours, "hours", 1, 200);
    }
  }
  if (!isUpdate || body.contactPhone !== undefined) {
    out.contactPhone = validatePhone(body.contactPhone, "contactPhone");
  }
  if (!isUpdate || body.accepts !== undefined) {
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
    if (body.notes === null || body.notes === "") {
      out.notes = undefined;
    } else {
      out.notes = validateString(body.notes, "notes", 1, 500);
    }
  }
  if (body.status !== undefined) {
    const s = String(body.status).trim();
    if (!["open", "paused", "closed"].includes(s)) throw err(400, "status must be open|paused|closed");
    out.status = s;
  }
  return out;
}

async function requireMember(auth, orgId, { ownerOnly }) {
  const org = await getOrg(auth.ddb, auth.tableName, orgId);
  if (!org) throw err(404, "not found");
  const membership = await getMembership(auth.ddb, auth.tableName, auth.payload.sub, orgId);
  if (membership) {
    if (ownerOnly && membership.role !== "owner") throw err(403, "Forbidden");
    return org;
  }
  if (!ownerOnly && ["moderator", "admin"].includes(auth.role)) {
    return org;
  }
  throw err(403, "Forbidden");
}

export async function handleCreateOrg(event, opts) {
  const auth = await requireAuth(event, opts);
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const validated = validateOrgBody(body, false);
  const owned = await countOwnedOrgs(auth.ddb, auth.tableName, auth.payload.sub);
  if (owned >= 3) throw err(400, "too many organizations");
  const id = randomUUID();
  const now = new Date().toISOString();
  const sub = auth.payload.sub;
  const email = auth.user?.email || auth.payload.email || "";
  const name = auth.user?.name || auth.payload.name || "";
  const item = {
    PK: `ORG#${id}`,
    SK: "META",
    type: "ORG",
    id,
    name: validated.name,
    orgType: validated.orgType,
    contactName: validated.contactName,
    contactPhone: validated.contactPhone,
    districts: validated.districts,
    description: validated.description,
    status: "pending",
    ownerSub: sub,
    createdAt: now,
    updatedAt: now,
    gsi2pk: "ORG#pending",
    gsi2sk: now,
  };
  if (validated.registrationNumber !== undefined) item.registrationNumber = validated.registrationNumber;
  if (validated.contactEmail !== undefined) item.contactEmail = validated.contactEmail;
  if (validated.website !== undefined) item.website = validated.website;
  if (email) item.ownerEmail = email;
  await createOrg(auth.ddb, auth.tableName, item);
  await putMembership(auth.ddb, auth.tableName, { sub, orgId: id, role: "owner", orgName: validated.name, email, name, createdAt: now });
  await recordAudit(auth.ddb, auth.tableName, { actorSub: sub, actorName: name, action: "org.create", targetType: "ORG", targetId: id, targetLabel: validated.name });
  return json(201, { id, status: "pending" });
}

export async function handleListMyOrgs(event, opts) {
  const auth = await requireAuth(event, opts);
  const emailRaw = auth.user?.email || auth.payload.email || "";
  const lower = String(emailRaw).toLowerCase().trim();
  if (lower) {
    const invites = await listInvitesForEmail(auth.ddb, auth.tableName, lower);
    for (const inv of invites) {
      const existing = await getMembership(auth.ddb, auth.tableName, auth.payload.sub, inv.orgId);
      if (existing) {
        await deleteInvite(auth.ddb, auth.tableName, lower, inv.orgId);
        continue;
      }
      const org = await getOrg(auth.ddb, auth.tableName, inv.orgId);
      if (!org) {
        await deleteInvite(auth.ddb, auth.tableName, lower, inv.orgId);
        continue;
      }
      const now = new Date().toISOString();
      const name = auth.user?.name || auth.payload.name || "";
      await putMembership(auth.ddb, auth.tableName, { sub: auth.payload.sub, orgId: inv.orgId, role: "staff", orgName: org.name, email: lower, name, createdAt: now });
      await deleteInvite(auth.ddb, auth.tableName, lower, inv.orgId);
    }
  }
  const memberships = await listUserMemberships(auth.ddb, auth.tableName, auth.payload.sub);
  const items = [];
  for (const m of memberships) {
    const org = await getOrg(auth.ddb, auth.tableName, m.orgId);
    if (!org) continue;
    items.push(toMyOrgView(org, m.role));
  }
  return json(200, { items });
}

export async function handleGetOrg(event, opts, orgId) {
  const auth = await requireAuth(event, opts);
  const org = await requireMember(auth, orgId, { ownerOnly: false });
  const membership = await getMembership(auth.ddb, auth.tableName, auth.payload.sub, orgId);
  if (!membership && !["moderator", "admin"].includes(auth.role)) throw err(403, "Forbidden");
  // requireMember already checks, but ensure private view only for members/mods
  return json(200, toPrivateOrgView(org));
}

export async function handleUpdateOrg(event, opts, orgId) {
  const auth = await requireAuth(event, opts);
  const org = await requireMember(auth, orgId, { ownerOnly: true });
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const keys = Object.keys(body);
  if (keys.length === 0) throw err(400, "no fields to update");
  const validated = validateOrgBody(body, true);
  // ensure at least one updatable field present
  const updatable = ["name", "orgType", "registrationNumber", "contactName", "contactPhone", "contactEmail", "districts", "description", "website"];
  let has = false;
  for (const k of updatable) if (k in validated) has = true;
  if (!has) throw err(400, "no fields to update");
  const now = new Date().toISOString();
  for (const k of updatable) {
    if (k in validated) {
      if (validated[k] === undefined) delete org[k];
      else org[k] = validated[k];
    }
  }
  org.updatedAt = now;
  await saveOrg(auth.ddb, auth.tableName, org);
  // refresh centers orgName if changed
  if (validated.name) {
    await refreshCentersForOrg(auth.ddb, auth.tableName, org);
  }
  const actorName = auth.user?.name || auth.payload.name || "";
  await recordAudit(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, actorName, action: "org.update", targetType: "ORG", targetId: orgId, targetLabel: org.name });
  return json(200, { ok: true });
}

export async function handleCreateCenter(event, opts, orgId) {
  const auth = await requireAuth(event, opts);
  const org = await requireMember(auth, orgId, { ownerOnly: true });
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const validated = validateCenterBody(body, false);
  const id = randomUUID();
  const now = new Date().toISOString();
  const center = {
    PK: `CENTER#${id}`,
    SK: "META",
    type: "CENTER",
    id,
    orgId,
    orgName: org.name,
    orgStatus: org.status,
    name: validated.name,
    district: validated.district,
    address: validated.address,
    contactPhone: validated.contactPhone,
    accepts: validated.accepts,
    status: "open",
    createdAt: now,
    updatedAt: now,
    createdBy: auth.payload.sub,
    createdByName: auth.user?.name || auth.payload.name || "",
    gsi1pk: `CENTER#${validated.district}`,
    gsi1sk: now,
    visibility: centerVisibility(org.status, "open"),
    gsi2pk: `CENTER#${centerVisibility(org.status, "open")}`,
    gsi2sk: now,
  };
  if (validated.ward !== undefined) center.ward = validated.ward;
  if (validated.lat !== undefined) center.lat = validated.lat;
  if (validated.lng !== undefined) center.lng = validated.lng;
  if (validated.hours !== undefined) center.hours = validated.hours;
  if (validated.notes !== undefined) center.notes = validated.notes;
  if (org.tier) center.orgTier = org.tier;
  await createCenter(auth.ddb, auth.tableName, center);
  const actorName = auth.user?.name || auth.payload.name || "";
  await recordAudit(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, actorName, action: "center.create", targetType: "CENTER", targetId: id, targetLabel: validated.name });
  return json(201, { id });
}

export async function handleListOrgCenters(event, opts, orgId) {
  const auth = await requireAuth(event, opts);
  await requireMember(auth, orgId, { ownerOnly: false });
  const pointers = await listOrgCenterPointers(auth.ddb, auth.tableName, orgId);
  const items = [];
  for (const p of pointers) {
    const c = await getCenter(auth.ddb, auth.tableName, p.centerId);
    if (!c) continue;
    items.push(toPrivateCenterView(c));
  }
  return json(200, { items });
}

export async function handleModerationOrgs(event, opts) {
  const auth = await requireModAuth(event, opts);
  const q = getQuery(event);
  const statusRaw = q.status ? String(q.status).trim() : "pending";
  if (!["pending", "verified", "rejected", "suspended"].includes(statusRaw)) throw err(400, "invalid status");
  const orgs = await listOrgsByStatus(auth.ddb, auth.tableName, statusRaw);
  const items = [];
  for (const org of orgs) {
    const pointers = await listOrgCenterPointers(auth.ddb, auth.tableName, org.id);
    const view = toModerationOrgView(org, pointers.length);
    items.push(view);
  }
  return json(200, { items });
}

export async function handleModerateOrg(event, opts, orgId) {
  const auth = await requireModAuth(event, opts);
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const action = body.action ? String(body.action).trim() : "";
  if (!["verify", "reject", "suspend", "reinstate"].includes(action)) throw err(400, "invalid action");
  const org = await getOrg(auth.ddb, auth.tableName, orgId);
  if (!org) throw err(404, "not found");
  const now = new Date().toISOString();
  const actorSub = auth.payload.sub;
  const actorName = auth.user?.name || auth.payload.name || "";
  if (action === "verify") {
    if (org.status !== "pending") throw err(400, "only pending organizations can be verified");
    const tier = body.tier ? String(body.tier).trim() : "";
    const note = body.note ? String(body.note).trim() : "";
    if (!TIERS.includes(tier)) throw err(400, "tier must be known|vouched|self_declared");
    if (note.length < 5 || note.length > 1000) throw err(400, "note must be 5-1000 characters");
    if (tier === "vouched" && (!Array.isArray(org.vouches) || org.vouches.length < 1)) throw err(400, "no vouches recorded");
    org.status = "verified";
    org.tier = tier;
    org.verifiedAt = now;
    org.verifiedBy = actorSub;
    org.verificationNote = note;
    org.updatedAt = now;
    org.gsi2pk = "ORG#verified";
    delete org.rejectionReason;
    delete org.suspendedAt;
    delete org.suspensionReason;
    await saveOrg(auth.ddb, auth.tableName, org);
    await refreshCentersForOrg(auth.ddb, auth.tableName, org);
    await recordAudit(auth.ddb, auth.tableName, { actorSub, actorName, action: "verify", targetType: "ORG", targetId: orgId, targetLabel: org.name, reason: note });
    return json(200, { status: "verified" });
  }
  if (action === "reject") {
    if (org.status !== "pending") throw err(400, "only pending organizations can be rejected");
    const reason = body.reason ? String(body.reason).trim() : "";
    if (reason.length < 5 || reason.length > 1000) throw err(400, "reason must be 5-1000 characters");
    org.status = "rejected";
    org.rejectionReason = reason;
    org.updatedAt = now;
    org.gsi2pk = "ORG#rejected";
    delete org.tier;
    delete org.verifiedAt;
    delete org.verifiedBy;
    delete org.verificationNote;
    await saveOrg(auth.ddb, auth.tableName, org);
    await refreshCentersForOrg(auth.ddb, auth.tableName, org);
    await recordAudit(auth.ddb, auth.tableName, { actorSub, actorName, action: "reject", targetType: "ORG", targetId: orgId, targetLabel: org.name, reason });
    return json(200, { status: "rejected" });
  }
  if (action === "suspend") {
    if (org.status !== "verified") throw err(400, "only verified organizations can be suspended");
    const reason = body.reason ? String(body.reason).trim() : "";
    if (reason.length < 5 || reason.length > 1000) throw err(400, "reason must be 5-1000 characters");
    org.status = "suspended";
    org.suspendedAt = now;
    org.suspensionReason = reason;
    org.updatedAt = now;
    org.gsi2pk = "ORG#suspended";
    await saveOrg(auth.ddb, auth.tableName, org);
    await refreshCentersForOrg(auth.ddb, auth.tableName, org);
    await recordAudit(auth.ddb, auth.tableName, { actorSub, actorName, action: "suspend", targetType: "ORG", targetId: orgId, targetLabel: org.name, reason });
    return json(200, { status: "suspended" });
  }
  if (action === "reinstate") {
    if (org.status !== "suspended") throw err(400, "only suspended organizations can be reinstated");
    org.status = "verified";
    org.updatedAt = now;
    org.gsi2pk = "ORG#verified";
    delete org.suspendedAt;
    delete org.suspensionReason;
    await saveOrg(auth.ddb, auth.tableName, org);
    await refreshCentersForOrg(auth.ddb, auth.tableName, org);
    await recordAudit(auth.ddb, auth.tableName, { actorSub, actorName, action: "reinstate", targetType: "ORG", targetId: orgId, targetLabel: org.name });
    return json(200, { status: "verified" });
  }
  throw err(400, "invalid action");
}

export async function handleVouch(event, opts, orgId) {
  const auth = await requireAuth(event, opts);
  const ddb = auth.ddb;
  const tableName = auth.tableName;
  const target = await getOrg(ddb, tableName, orgId);
  if (!target) throw err(404, "not found");
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const voucherOrgId = body.voucherOrgId ? String(body.voucherOrgId).trim() : "";
  if (!voucherOrgId) throw err(400, "voucherOrgId required");
  if (voucherOrgId === orgId) throw err(400, "cannot vouch for self");
  if (target.status !== "pending") throw err(400, "only pending organizations can be vouched");
  const voucherOrg = await getOrg(ddb, tableName, voucherOrgId);
  if (!voucherOrg) throw err(404, "not found");
  const mem = await getMembership(ddb, tableName, auth.payload.sub, voucherOrgId);
  if (!mem || mem.role !== "owner") throw err(403, "Forbidden");
  if (voucherOrg.status !== "verified") throw err(403, "Forbidden");
  const vouches = Array.isArray(target.vouches) ? target.vouches : [];
  if (vouches.some((v) => v.orgId === voucherOrgId)) throw err(400, "already vouched");
  const now = new Date().toISOString();
  const entry = {
    orgId: voucherOrgId,
    orgName: voucherOrg.name,
    sub: auth.payload.sub,
    at: now,
  };
  target.vouches = [...vouches, entry];
  target.updatedAt = now;
  await saveOrg(ddb, tableName, target);
  const actorName = auth.user?.name || auth.payload.name || "";
  await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "org.vouch", targetType: "ORG", targetId: orgId, targetLabel: target.name, reason: `vouched by ${voucherOrg.name}` });
  return json(200, { ok: true });
}


export async function handleInviteMember(event, opts, orgId) {
  const auth = await requireAuth(event, opts);
  await requireMember(auth, orgId, { ownerOnly: true });
  const org = await getOrg(auth.ddb, auth.tableName, orgId);
  if (!org) throw err(404, "not found");
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  let emailRaw = body.email;
  if (emailRaw === undefined || emailRaw === null) throw err(400, "email required");
  if (typeof emailRaw !== "string") throw err(400, "email must be a string");
  const emailTrim = emailRaw.trim();
  if (emailTrim.length === 0) throw err(400, "email required");
  if (emailTrim.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) throw err(400, "email is not a valid email");
  const lower = emailTrim.toLowerCase();
  const members = await listOrgMembers(auth.ddb, auth.tableName, orgId);
  if (members.some((m) => m.email && String(m.email).toLowerCase() === lower)) {
    throw err(400, "already a member");
  }
  const emailPointer = await getEmailPointer(auth.ddb, auth.tableName, lower);
  if (emailPointer && emailPointer.sub) {
    const existingMem = await getMembership(auth.ddb, auth.tableName, emailPointer.sub, orgId);
    if (existingMem) throw err(400, "already a member");
  }
  const existingInvite = await getInviteForEmail(auth.ddb, auth.tableName, lower, orgId);
  if (existingInvite) throw err(400, "already invited");
  const existingInvite2 = await getInviteForOrg(auth.ddb, auth.tableName, orgId, lower);
  if (existingInvite2) throw err(400, "already invited");
  if (emailPointer && emailPointer.sub) {
    const sub = emailPointer.sub;
    let userItem = null;
    try {
      const res = await auth.ddb.send(new GetCommand({ TableName: auth.tableName, Key: { PK: `USER#${sub}`, SK: "PROFILE" } }));
      userItem = res.Item;
    } catch {}
    const email = userItem?.email || lower;
    const name = userItem?.name || "";
    const now = new Date().toISOString();
    await putMembership(auth.ddb, auth.tableName, { sub, orgId, role: "staff", orgName: org.name, email, name, createdAt: now });
    const actorName = auth.user?.name || auth.payload.name || "";
    await recordAudit(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, actorName, action: "org.member.invite", targetType: "ORG", targetId: orgId, targetLabel: org.name, reason: email });
    return json(201, { status: "member" });
  } else {
    const now = new Date().toISOString();
    const invitedBy = auth.payload.sub;
    await putInvite(auth.ddb, auth.tableName, { orgId, orgName: org.name, email: lower, invitedBy, createdAt: now });
    const actorName = auth.user?.name || auth.payload.name || "";
    await recordAudit(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, actorName, action: "org.member.invite", targetType: "ORG", targetId: orgId, targetLabel: org.name, reason: lower });
    return json(201, { status: "invited" });
  }
}

export async function handleListMembers(event, opts, orgId) {
  const auth = await requireAuth(event, opts);
  await requireMember(auth, orgId, { ownerOnly: true });
  const members = await listOrgMembers(auth.ddb, auth.tableName, orgId);
  const invites = await listInvitesForOrg(auth.ddb, auth.tableName, orgId);
  const items = [];
  for (const m of members) {
    const out = { role: m.role, status: "member", createdAt: m.createdAt };
    if (m.sub !== undefined) out.sub = m.sub;
    if (m.email !== undefined) out.email = m.email;
    if (m.name !== undefined) out.name = m.name;
    items.push(out);
  }
  for (const inv of invites) {
    const out = { role: inv.role || "staff", status: "invited", createdAt: inv.createdAt, email: inv.email };
    if (inv.name !== undefined) out.name = inv.name;
    items.push(out);
  }
  items.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  return json(200, { items });
}

export async function handleRemoveMember(event, opts, orgId, subOrEmail) {
  const auth = await requireAuth(event, opts);
  await requireMember(auth, orgId, { ownerOnly: true });
  const param = decodeURIComponent(subOrEmail);
  const ddb = auth.ddb;
  const tableName = auth.tableName;
  const isEmail = param.includes("@");
  if (isEmail) {
    const lower = param.toLowerCase().trim();
    const pointer = await getEmailPointer(ddb, tableName, lower);
    if (pointer && pointer.sub) {
      const mem = await getMembership(ddb, tableName, pointer.sub, orgId);
      if (mem) {
        if (mem.role === "owner") {
          const all = await listOrgMembers(ddb, tableName, orgId);
          const owners = all.filter((m) => m.role === "owner");
          if (owners.length <= 1) throw err(400, "cannot remove the last owner");
        }
        await deleteMembership(ddb, tableName, pointer.sub, orgId);
        const actorName = auth.user?.name || auth.payload.name || "";
        await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "org.member.remove", targetType: "ORG", targetId: orgId, targetLabel: param });
        return json(200, { ok: true });
      }
    }
    const inv = await getInviteForEmail(ddb, tableName, lower, orgId);
    const inv2 = await getInviteForOrg(ddb, tableName, orgId, lower);
    if (inv || inv2) {
      await deleteInvite(ddb, tableName, lower, orgId);
      const actorName = auth.user?.name || auth.payload.name || "";
      await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "org.member.remove", targetType: "ORG", targetId: orgId, targetLabel: param });
      return json(200, { ok: true });
    }
    const members = await listOrgMembers(ddb, tableName, orgId);
    const found = members.find((m) => m.email && String(m.email).toLowerCase() === lower);
    if (found) {
      if (found.role === "owner") {
        const owners = members.filter((m) => m.role === "owner");
        if (owners.length <= 1) throw err(400, "cannot remove the last owner");
      }
      await deleteMembership(ddb, tableName, found.sub, orgId);
      const actorName = auth.user?.name || auth.payload.name || "";
      await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "org.member.remove", targetType: "ORG", targetId: orgId, targetLabel: param });
      return json(200, { ok: true });
    }
    throw err(404, "not found");
  } else {
    const sub = param;
    const mem = await getMembership(ddb, tableName, sub, orgId);
    if (!mem) throw err(404, "not found");
    if (mem.role === "owner") {
      const all = await listOrgMembers(ddb, tableName, orgId);
      const owners = all.filter((m) => m.role === "owner");
      if (owners.length <= 1) throw err(400, "cannot remove the last owner");
    }
    await deleteMembership(ddb, tableName, sub, orgId);
    const actorName = auth.user?.name || auth.payload.name || "";
    await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "org.member.remove", targetType: "ORG", targetId: orgId, targetLabel: sub });
    return json(200, { ok: true });
  }
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
