import { json, err, parseBody } from "../lib/http.js";
import { requireAuth } from "../lib/auth.js";
import { getOrg, getMembership } from "../models/org.js";
import { getNeedById, setNeedStatus } from "../models/need.js";
import { fulfilNeed } from "../models/claim.js";
import { putOrgNeed, deleteOrgNeed, listOrgNeeds } from "../models/orgNeed.js";
import { recordAudit, getTargetLabelForAudit } from "../models/audit.js";
import { maskName } from "../lib/format.js";

/** A verified organization's member may take a published need, hand it back, or mark it delivered. */
async function requireVerifiedMember(auth, orgId) {
  const org = await getOrg(auth.ddb, auth.tableName, orgId);
  if (!org) throw err(404, "not found");
  if (!(await getMembership(auth.ddb, auth.tableName, auth.payload.sub, orgId))) throw err(403, "Forbidden");
  if (org.status !== "verified") throw err(403, "org_not_verified");
  return org;
}

function actor(auth) {
  return { actorSub: auth.payload.sub, actorName: auth.user?.name || auth.payload.name || "" };
}

/** Contact the organization needs to deliver. Only returned to the org that took the need. */
function contactView(need) {
  return {
    id: need.id, status: need.status, category: need.category, description: need.description, createdAt: need.createdAt,
    beneficiary: { name: need.beneficiary?.name || "", phone: need.beneficiary?.phone || null, district: need.beneficiary?.district || need.district, ward: need.beneficiary?.ward ?? need.ward },
    handledAt: need.handledBy?.at,
  };
}

export async function handleOrgClaimNeed(event, opts, orgId, needId) {
  const auth = await requireAuth(event, opts);
  const org = await requireVerifiedMember(auth, orgId);
  const need = await getNeedById(auth.ddb, auth.tableName, needId);
  if (!need) throw err(404, "not found");
  if (need.status !== "published") throw err(409, "need_not_available");
  const at = new Date().toISOString();
  need.handledBy = { orgId, orgName: org.name, bySub: auth.payload.sub, at };
  await setNeedStatus(auth.ddb, auth.tableName, { need, status: "matched", expectedStatus: "published" }).catch((e) => {
    if (e.status === 409) throw err(409, "need_not_available");
    throw e;
  });
  await putOrgNeed(auth.ddb, auth.tableName, { orgId, needId, status: "matched", at });
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "org.claim", targetType: "NEED", targetId: needId, targetLabel: getTargetLabelForAudit("NEED", need), reason: org.name });
  return json(200, contactView(need));
}

async function requireHandledByOrg(auth, orgId, needId) {
  const need = await getNeedById(auth.ddb, auth.tableName, needId);
  if (!need) throw err(404, "not found");
  if (need.status !== "matched" || need.handledBy?.orgId !== orgId) throw err(409, "need_not_handled_by_org");
  return need;
}

export async function handleOrgReleaseNeed(event, opts, orgId, needId) {
  const auth = await requireAuth(event, opts);
  const org = await requireVerifiedMember(auth, orgId);
  const need = await requireHandledByOrg(auth, orgId, needId);
  delete need.handledBy;
  await setNeedStatus(auth.ddb, auth.tableName, { need, status: "published", expectedStatus: "matched" }).catch((e) => {
    if (e.status === 409) throw err(409, "need_not_handled_by_org");
    throw e;
  });
  await deleteOrgNeed(auth.ddb, auth.tableName, { orgId, needId });
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "org.release", targetType: "NEED", targetId: needId, targetLabel: getTargetLabelForAudit("NEED", need), reason: org.name });
  return json(200, { status: "published" });
}

export async function handleOrgDeliverNeed(event, opts, orgId, needId) {
  const auth = await requireAuth(event, opts);
  const org = await requireVerifiedMember(auth, orgId);
  const need = await requireHandledByOrg(auth, orgId, needId);
  const body = parseBody(event) || {};
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") throw err(400, "note must be string");
  const at = await fulfilNeed(auth.ddb, auth.tableName, { need, note: body.note, ...actor(auth), reason: `org:${org.name}`, orgName: org.name, expectedStatus: "matched" }).catch((e) => {
    if (e.status === 409) throw err(409, "need_not_handled_by_org");
    throw e;
  });
  await putOrgNeed(auth.ddb, auth.tableName, { orgId, needId, status: "fulfilled", at });
  return json(200, { status: "fulfilled", redeemedAt: at });
}

export async function handleListOrgNeeds(event, opts, orgId) {
  const auth = await requireAuth(event, opts);
  const org = await getOrg(auth.ddb, auth.tableName, orgId);
  if (!org) throw err(404, "not found");
  if (!(await getMembership(auth.ddb, auth.tableName, auth.payload.sub, orgId))) throw err(403, "Forbidden");
  const items = [];
  for (const p of await listOrgNeeds(auth.ddb, auth.tableName, orgId)) {
    const need = await getNeedById(auth.ddb, auth.tableName, p.needId);
    if (!need) continue;
    // Contact only while delivery is in progress; afterwards the masked name is enough.
    items.push(need.status === "matched" && need.handledBy?.orgId === orgId
      ? contactView(need)
      : { ...contactView(need), beneficiary: { name: maskName(need.beneficiary?.name || ""), phone: null, district: need.beneficiary?.district || need.district, ward: need.beneficiary?.ward ?? need.ward } });
  }
  return json(200, { items });
}
