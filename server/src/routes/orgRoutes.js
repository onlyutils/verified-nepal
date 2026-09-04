import { err } from "../lib/http.js";
import {
  handleCreateOrg,
  handleListMyOrgs,
  handleGetOrg,
  handleUpdateOrg,
  handleCreateCenter,
  handleListOrgCenters,
  handleModerationOrgs,
  handleModerateOrg,
  handleVouch,
  handleCenterFlags,
  handleInviteMember,
  handleAcceptInvite,
  handleDeclineInvite,
  handleListMembers,
  handleRemoveMember,
} from "../controllers/orgController.js";
import { handleOrgClaimNeed, handleOrgReleaseNeed, handleOrgDeliverNeed, handleListOrgNeeds } from "../controllers/orgNeedController.js";
import {
  handleListCenters,
  handleGetCenter,
  handleUpdateCenter,
  handleGetStock,
  handleListEntries,
  handleCreateEntry,
  handleGoodsLedger,
  handleInbound,
  handleReceive,
  handleFlagCenter,
  handleCreateDonation,
  handleGetDonation,
  handleListDonations,
  handleConfirmDonation,
} from "../controllers/centerController.js";

const routes = [
  ["POST", /^\/orgs$/, (e, o) => handleCreateOrg(e, o)],
  ["GET", /^\/orgs\/mine$/, (e, o) => handleListMyOrgs(e, o)],
  ["POST", /^\/orgs\/([^\/]+)\/members$/, (e, o, m) => handleInviteMember(e, o, decodeURIComponent(m[1]))],
  ["GET", /^\/orgs\/([^\/]+)\/members$/, (e, o, m) => handleListMembers(e, o, decodeURIComponent(m[1]))],
  ["DELETE", /^\/orgs\/([^\/]+)\/members\/([^\/]+)$/, (e, o, m) => handleRemoveMember(e, o, decodeURIComponent(m[1]), decodeURIComponent(m[2]))],
  ["POST", /^\/orgs\/([^\/]+)\/accept-invite$/, (e, o, m) => handleAcceptInvite(e, o, decodeURIComponent(m[1]))],
  ["POST", /^\/orgs\/([^\/]+)\/decline-invite$/, (e, o, m) => handleDeclineInvite(e, o, decodeURIComponent(m[1]))],
  ["POST", /^\/orgs\/([^\/]+)\/vouch$/, (e, o, m) => handleVouch(e, o, decodeURIComponent(m[1]))],
  ["GET", /^\/orgs\/([^\/]+)$/, (e, o, m) => handleGetOrg(e, o, decodeURIComponent(m[1]))],
  ["POST", /^\/orgs\/([^\/]+)$/, (e, o, m) => handleUpdateOrg(e, o, decodeURIComponent(m[1]))],
  ["POST", /^\/orgs\/([^\/]+)\/centers$/, (e, o, m) => handleCreateCenter(e, o, decodeURIComponent(m[1]))],
  ["GET", /^\/orgs\/([^\/]+)\/centers$/, (e, o, m) => handleListOrgCenters(e, o, decodeURIComponent(m[1]))],
  ["GET", /^\/orgs\/([^\/]+)\/needs$/, (e, o, m) => handleListOrgNeeds(e, o, decodeURIComponent(m[1]))],
  ["POST", /^\/orgs\/([^\/]+)\/needs\/([^\/]+)\/claim$/, (e, o, m) => handleOrgClaimNeed(e, o, decodeURIComponent(m[1]), decodeURIComponent(m[2]))],
  ["POST", /^\/orgs\/([^\/]+)\/needs\/([^\/]+)\/release$/, (e, o, m) => handleOrgReleaseNeed(e, o, decodeURIComponent(m[1]), decodeURIComponent(m[2]))],
  ["POST", /^\/orgs\/([^\/]+)\/needs\/([^\/]+)\/deliver$/, (e, o, m) => handleOrgDeliverNeed(e, o, decodeURIComponent(m[1]), decodeURIComponent(m[2]))],
  ["GET", /^\/moderation\/center-flags$/, (e, o) => handleCenterFlags(e, o)],
  ["GET", /^\/centers$/, (e, o) => handleListCenters(e, o)],
  ["GET", /^\/centers\/([^\/]+)\/inbound$/, (e, o, m) => handleInbound(e, o, decodeURIComponent(m[1]))],
  ["POST", /^\/centers\/([^\/]+)\/flag$/, (e, o, m) => handleFlagCenter(e, o, decodeURIComponent(m[1]))],
  ["POST", /^\/centers\/([^\/]+)\/donations$/, (e, o, m) => handleCreateDonation(e, o, decodeURIComponent(m[1]))],
  ["GET", /^\/centers\/([^\/]+)\/donations$/, (e, o, m) => handleListDonations(e, o, decodeURIComponent(m[1]))],
  ["GET", /^\/centers\/([^\/]+)$/, (e, o, m) => handleGetCenter(e, o, decodeURIComponent(m[1]))],
  ["POST", /^\/centers\/([^\/]+)$/, (e, o, m) => handleUpdateCenter(e, o, decodeURIComponent(m[1]))],
  ["GET", /^\/centers\/([^\/]+)\/stock$/, (e, o, m) => handleGetStock(e, o, decodeURIComponent(m[1]))],
  ["GET", /^\/centers\/([^\/]+)\/entries$/, (e, o, m) => handleListEntries(e, o, decodeURIComponent(m[1]))],
  ["POST", /^\/centers\/([^\/]+)\/entries$/, (e, o, m) => handleCreateEntry(e, o, decodeURIComponent(m[1]))],
  ["POST", /^\/transfers\/([^\/]+)\/receive$/, (e, o, m) => handleReceive(e, o, decodeURIComponent(m[1]))],
  ["GET", /^\/donations\/([^\/]+)$/, (e, o, m) => handleGetDonation(e, o, decodeURIComponent(m[1]))],
  ["POST", /^\/donations\/([^\/]+)\/confirm$/, (e, o, m) => handleConfirmDonation(e, o, decodeURIComponent(m[1]))],
  ["GET", /^\/goods-ledger$/, (e, o) => handleGoodsLedger(e, o)],
  ["GET", /^\/moderation\/orgs$/, (e, o) => handleModerationOrgs(e, o)],
  ["POST", /^\/moderation\/orgs\/([^\/]+)$/, (e, o, m) => handleModerateOrg(e, o, decodeURIComponent(m[1]))],
];

export async function routeOrgs(method, path, event, opts) {
  const m = method.toUpperCase();
  const p = path.split("?")[0];
  for (const [rm, re, handler] of routes) {
    if (rm !== m) continue;
    const match = p.match(re);
    if (!match) continue;
    try {
      const res = await handler(event, opts, match);
      return res;
    } catch (e) {
      const status = e.status ?? e.statusCode ?? 500;
      const safe = status === 500 ? "Internal Server Error" : e.message || "Error";
      return {
        statusCode: status,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: safe }),
      };
    }
  }
  return null;
}
