import { dispatch } from "../lib/http.js";
import { compose, withAuth, withModAuth, withGuidelinesAck } from "../lib/middleware.js";
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

const withModAck = compose(withModAuth, withGuidelinesAck);

const routes = [
  ["POST", /^\/orgs$/, withAuth(handleCreateOrg)],
  ["GET", /^\/orgs\/mine$/, withAuth(handleListMyOrgs)],
  ["POST", /^\/orgs\/([^\/]+)\/members$/, withAuth(handleInviteMember)],
  ["GET", /^\/orgs\/([^\/]+)\/members$/, withAuth(handleListMembers)],
  ["DELETE", /^\/orgs\/([^\/]+)\/members\/([^\/]+)$/, withAuth(handleRemoveMember)],
  ["POST", /^\/orgs\/([^\/]+)\/accept-invite$/, withAuth(handleAcceptInvite)],
  ["POST", /^\/orgs\/([^\/]+)\/decline-invite$/, withAuth(handleDeclineInvite)],
  ["POST", /^\/orgs\/([^\/]+)\/vouch$/, withAuth(handleVouch)],
  ["GET", /^\/orgs\/([^\/]+)$/, withAuth(handleGetOrg)],
  ["POST", /^\/orgs\/([^\/]+)$/, withAuth(handleUpdateOrg)],
  ["POST", /^\/orgs\/([^\/]+)\/centers$/, withAuth(handleCreateCenter)],
  ["GET", /^\/orgs\/([^\/]+)\/centers$/, withAuth(handleListOrgCenters)],
  ["GET", /^\/orgs\/([^\/]+)\/needs$/, withAuth(handleListOrgNeeds)],
  ["POST", /^\/orgs\/([^\/]+)\/needs\/([^\/]+)\/claim$/, withAuth(handleOrgClaimNeed)],
  ["POST", /^\/orgs\/([^\/]+)\/needs\/([^\/]+)\/release$/, withAuth(handleOrgReleaseNeed)],
  ["POST", /^\/orgs\/([^\/]+)\/needs\/([^\/]+)\/deliver$/, withAuth(handleOrgDeliverNeed)],
  ["GET", /^\/moderation\/center-flags$/, withModAck(handleCenterFlags)],
  ["GET", /^\/centers$/, handleListCenters],
  ["GET", /^\/centers\/([^\/]+)\/inbound$/, withAuth(handleInbound)],
  ["POST", /^\/centers\/([^\/]+)\/flag$/, handleFlagCenter],
  ["POST", /^\/centers\/([^\/]+)\/donations$/, handleCreateDonation],
  ["GET", /^\/centers\/([^\/]+)\/donations$/, withAuth(handleListDonations)],
  ["GET", /^\/centers\/([^\/]+)$/, handleGetCenter],
  ["POST", /^\/centers\/([^\/]+)$/, withAuth(handleUpdateCenter)],
  ["GET", /^\/centers\/([^\/]+)\/stock$/, handleGetStock],
  ["GET", /^\/centers\/([^\/]+)\/entries$/, handleListEntries],
  ["POST", /^\/centers\/([^\/]+)\/entries$/, withAuth(handleCreateEntry)],
  ["POST", /^\/transfers\/([^\/]+)\/receive$/, withAuth(handleReceive)],
  ["GET", /^\/donations\/([^\/]+)$/, handleGetDonation],
  ["POST", /^\/donations\/([^\/]+)\/confirm$/, withAuth(handleConfirmDonation)],
  ["GET", /^\/goods-ledger$/, handleGoodsLedger],
  ["GET", /^\/moderation\/orgs$/, withModAck(handleModerationOrgs)],
  ["POST", /^\/moderation\/orgs\/([^\/]+)$/, withModAck(handleModerateOrg)],
];

export async function routeOrgs(method, path, event, opts) {
  try {
    return await dispatch(routes, method.toUpperCase(), path.split("?")[0], event, opts);
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
