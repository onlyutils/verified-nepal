import { json, err, parseBody } from "../lib/http.js";
import { getOrg, getMembership } from "../models/org.js";
import { listOrgCenterPointers, getCenter } from "../models/center.js";
import { listCenterDonationsRaw, getDonation } from "../models/donation.js";
import { getEntryById } from "../models/goods.js";
import { createEntryForCenter } from "./centerController.js";
import { getNeedById, setNeedStatus } from "../models/need.js";
import { fulfilNeed } from "../models/claim.js";
import { putOrgNeed, deleteOrgNeed, listOrgNeeds } from "../models/orgNeed.js";
import { recordAudit, getTargetLabelForAudit } from "../models/audit.js";
import { maskName } from "../lib/format.js";
import { needTimeline } from "../views/need-timeline.js";
import { getMunicipality } from "../lib/adminUnits.js";
import { notifyRequester } from "../lib/notify.js";

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
    beneficiary: { name: need.beneficiary?.name || "", phone: need.beneficiary?.phone || null, district: need.beneficiary?.district || need.district, ward: need.beneficiary?.ward ?? need.ward, municipalityId: need.beneficiary?.municipalityId, municipality: getMunicipality(need.beneficiary?.municipalityId)?.name },
    handledAt: need.handledBy?.at,
  };
}

function donationContext(need, donation) {
  return {
    ref: donation.ref,
    center: { id: donation.centerId, name: donation.centerName, district: donation.district },
    category: donation.category,
    qty: donation.qty,
    receivedAt: donation.receivedAt,
    maskedBeneficiary: maskName(need.beneficiary?.name || ""),
    groupSize: Object.keys(need.groupMembers || {}).length || undefined,
  };
}

async function findReceivedDonation(auth, needId, orgId) {
  const centers = await listOrgCenterPointers(auth.ddb, auth.tableName, orgId);
  for (const pointer of centers) {
    const donations = await listCenterDonationsRaw(auth.ddb, auth.tableName, pointer.centerId);
    const donation = donations.find((item) => item.needId === needId && item.status === "received");
    if (donation) {
      const center = await getCenter(auth.ddb, auth.tableName, pointer.centerId);
      if (center) return { donation, center };
    }
  }
  return null;
}

export async function handleOrgClaimNeed(event, opts, orgId, needId) {
  const { auth } = opts;
  const org = await requireVerifiedMember(auth, orgId);
  const need = await getNeedById(auth.ddb, auth.tableName, needId);
  if (!need) throw err(404, "not found");
  if (need.status !== "published") throw err(409, "need_not_available");
  if (need.handledBy) throw err(409, "need_not_available");
  const at = new Date().toISOString();
  need.handledBy = { orgId, orgName: org.name, bySub: auth.payload.sub, at };
  need.contactViewedBy ||= {};
  await setNeedStatus(auth.ddb, auth.tableName, { need, status: "matched", expectedStatus: "published" }).catch((e) => {
    if (e.status === 409) throw err(409, "need_not_available");
    throw e;
  });
  await putOrgNeed(auth.ddb, auth.tableName, { orgId, needId, status: "matched", at });
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "org.claim", targetType: "NEED", targetId: needId, targetLabel: getTargetLabelForAudit("NEED", need), reason: org.name });
  // TODO(sms): Sparrow SMS to registrant.phone once provisioned
  await notifyRequester(auth.ddb, auth.tableName, need, "taken", { label: org.name });
  return json(200, contactView(need));
}

async function requireHandledByOrg(auth, orgId, needId, allowReceivedHandover = false) {
  const need = await getNeedById(auth.ddb, auth.tableName, needId);
  if (!need) throw err(404, "not found");
  if (need.status === "matched" && need.handledBy?.orgId === orgId) return { need, handover: null };
  if (allowReceivedHandover && need.status === "matched" && ["helper", "group"].includes(need.handledBy?.kind)) {
    const handover = await findReceivedDonation(auth, needId, orgId);
    if (handover) return { need, handover };
  }
  throw err(409, "need_not_handled_by_org");
}

export async function handleOrgReleaseNeed(event, opts, orgId, needId) {
  const { auth } = opts;
  const org = await requireVerifiedMember(auth, orgId);
  const { need } = await requireHandledByOrg(auth, orgId, needId);
  delete need.handledBy;
  await setNeedStatus(auth.ddb, auth.tableName, { need, status: "published", expectedStatus: "matched" }).catch((e) => {
    if (e.status === 409) throw err(409, "need_not_handled_by_org");
    throw e;
  });
  await deleteOrgNeed(auth.ddb, auth.tableName, { orgId, needId });
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "org.release", targetType: "NEED", targetId: needId, targetLabel: getTargetLabelForAudit("NEED", need), reason: org.name });
  // TODO(sms): Sparrow SMS to registrant.phone once provisioned
  await notifyRequester(auth.ddb, auth.tableName, need, "released", { label: org.name });
  return json(200, { status: "published" });
}

export async function handleOrgDeliverNeed(event, opts, orgId, needId) {
  const { auth } = opts;
  const org = await requireVerifiedMember(auth, orgId);
  const { need, handover } = await requireHandledByOrg(auth, orgId, needId, true);
  const body = parseBody(event) || {};
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") throw err(400, "note must be string");
  const deliveredBy = handover ? {
    kind: need.handledBy.kind,
    label: need.handledBy.label,
    via: { centerId: handover.center.id, centerName: handover.center.name, orgName: org.name },
  } : undefined;
  const at = await fulfilNeed(auth.ddb, auth.tableName, { need, note: body.note, ...actor(auth), reason: `org:${org.name}`, orgName: org.name, deliveredBy, expectedStatus: "matched" }).catch((e) => {
    if (e.status === 409) throw err(409, "need_not_handled_by_org");
    throw e;
  });
  if (handover) {
    const intake = handover.donation.intakeEntryId ? await getEntryById(auth.ddb, auth.tableName, handover.donation.intakeEntryId) : null;
    const qty = intake?.qty ?? handover.donation.qtyReceived ?? handover.donation.qty;
    if (qty > 0) {
      await createEntryForCenter({
        ddb: auth.ddb, tableName: auth.tableName, center: handover.center, auth,
        entryType: "distribution", category: handover.donation.category, qty,
        note: `Handed over for need ${need.id}`, donationRef: handover.donation.ref, needId: need.id,
      });
    }
  }
  await putOrgNeed(auth.ddb, auth.tableName, { orgId, needId, status: "fulfilled", at });
  // TODO(sms): Sparrow SMS to registrant.phone once provisioned
  await notifyRequester(auth.ddb, auth.tableName, need, "delivered", { label: deliveredBy?.label || org.name });
  return json(200, { status: "fulfilled", redeemedAt: at });
}

export async function handleListOrgNeeds(event, opts, orgId) {
  const { auth } = opts;
  const org = await getOrg(auth.ddb, auth.tableName, orgId);
  if (!org) throw err(404, "not found");
  if (!(await getMembership(auth.ddb, auth.tableName, auth.payload.sub, orgId))) throw err(403, "Forbidden");
  const items = [];
  const seen = new Set();
  for (const p of await listOrgNeeds(auth.ddb, auth.tableName, orgId)) {
    const need = await getNeedById(auth.ddb, auth.tableName, p.needId);
    if (!need) continue;
    // Contact only while delivery is in progress; afterwards the masked name is enough.
    seen.add(need.id);
    items.push(need.status === "matched" && need.handledBy?.orgId === orgId
      ? contactView(need)
      : { ...contactView(need), beneficiary: { name: maskName(need.beneficiary?.name || ""), phone: null, district: need.beneficiary?.district || need.district, ward: need.beneficiary?.ward ?? need.ward } });
  }
  for (const centerPointer of await listOrgCenterPointers(auth.ddb, auth.tableName, orgId)) {
    const donations = await listCenterDonationsRaw(auth.ddb, auth.tableName, centerPointer.centerId);
    for (const donation of donations.filter((item) => item.needId && item.status === "received" && !seen.has(item.needId))) {
      const need = await getNeedById(auth.ddb, auth.tableName, donation.needId);
      if (!need || need.status !== "matched" || !["helper", "group"].includes(need.handledBy?.kind)) continue;
      seen.add(need.id);
      const context = donationContext(need, donation);
      items.push({
        ...contactView(need),
        beneficiary: { name: context.maskedBeneficiary, phone: null, district: need.beneficiary?.district || need.district, ward: need.beneficiary?.ward ?? need.ward },
        handover: true,
        handledBy: need.handledBy.label,
        donation: context,
        timeline: needTimeline(need, { donation }),
      });
    }
  }
  return json(200, { items });
}
