import { json, err, dispatch } from "./lib/http.js";
import { compose, withAuth, withOptionalAuth, withModAuth, withGuidelinesAck } from "./lib/middleware.js";
import { routeOrgs } from "./routes/orgRoutes.js";
import { handleAuthExchange, handleAuthRefresh, handleMe, handleAckGuidelines, handleSetMyDistricts } from "./controllers/authController.js";
import { handleAdminUsersLookup, handleAdminUsersList, handleAdminStats, handleAdminUsersRole } from "./controllers/adminController.js";
import { handleGetAudit } from "./controllers/auditController.js";
import {
  handleGetIncidents, handleGetAdminIncidents, handlePostAdminIncident, handlePostIncidentRequest,
  handlePublishIncident, handleArchiveIncident, handleApproveIncident, handleRejectIncident, handleEditIncident,
} from "./controllers/incidentController.js";
import {
  handlePostNeeds, handlePostNeedsMediaPresign, handleGetNeeds, handleGetStatus, handlePostRenew,
  handlePostNeedStatus, handlePostNeedEdit, handlePostFlag, handleGetFlags,
} from "./controllers/needController.js";
import { handlePostOffers, handleGetOffers, handlePostOfferStatus, handlePostOfferEdit } from "./controllers/offerController.js";
import {
  handleGetDashboard, handlePostNeedClaim, handlePostMissingPresign, handlePutMissing, handleGetMissing, handleDeleteMissing,
} from "./controllers/meController.js";
import {
  handleGetModerationQueue, handlePostModeration, handlePostModerationClaim, handlePostModerationRelease,
} from "./controllers/moderationController.js";
import {
  handlePostGroup, handlePostGroupJoin, handlePostGroupItem,
  handlePostGroupItemClaim, handlePostGroupItemRelease, handlePostGroupItemDone,
} from "./controllers/groupController.js";
import { handleRedeem, handleSync, handlePrint, handleLedger } from "./controllers/claimController.js";
import {
  handlePostProject, handleGetProjects, handleGetProject, handlePostPresign, handlePostPhoto,
  handlePostUpdate, handleGetModerationProjects, handlePostModerationProject, handlePostModerationUpdate,
} from "./controllers/projectController.js";
import {
  handlePostArticle, handleGetMyArticles, handleGetMyArticle, handlePutArticle, handleSubmitArticle,
  handleDeleteArticle, handlePostArticlePresign, handlePostArticleView, handlePostArticleShare, handlePostArticleLike,
  handleGetDispatches, handleGetModerationDispatches, handlePostModerationDispatch, handleGetDispatch,
} from "./controllers/dispatchController.js";
import { handlePostStory, handleGetMyStories, handleDeleteStory, handleGetStories, handleGetModerationStories, handlePostModerationStory } from "./controllers/storyController.js";
import {
  handlePostClimateMessage, handleGetClimateMessages, handlePostClimateDownload, handleGetAdminClimate,
} from "./controllers/climateController.js";

const withModAck = compose(withModAuth, withGuidelinesAck);

// Order matters: first match wins. Unwrapped handlers are public, or (handleMe, handlePostNeeds,
// project photo/update) decide auth themselves from the request body / committee code.
const routes = [
  ["GET", /^\/health$/, () => json(200, { ok: true })],
  ["POST", /^\/auth\/exchange$/, handleAuthExchange],
  ["POST", /^\/auth\/refresh$/, handleAuthRefresh],
  ["GET", /^\/me$/, handleMe],
  ["POST", /^\/me\/ack-guidelines$/, withAuth(handleAckGuidelines)],
  ["POST", /^\/me\/districts$/, withAuth(handleSetMyDistricts)],
  ["GET", /^\/me\/dashboard$/, withAuth(handleGetDashboard)],
  ["POST", /^\/me\/articles$/, withAuth(handlePostArticle)],
  ["GET", /^\/me\/articles$/, withAuth(handleGetMyArticles)],
  ["POST", /^\/me\/articles\/media\/presign$/, withAuth(handlePostArticlePresign)],
  ["POST", /^\/me\/articles\/([^/]+)\/submit$/, withAuth(handleSubmitArticle)],
  ["PUT", /^\/me\/articles\/([^/]+)$/, withAuth(handlePutArticle)],
  ["DELETE", /^\/me\/articles\/([^/]+)$/, withAuth(handleDeleteArticle)],
  ["GET", /^\/me\/articles\/([^/]+)$/, withAuth(handleGetMyArticle)],
  ["POST", /^\/me\/stories$/, withAuth(handlePostStory)],
  ["GET", /^\/me\/stories$/, withAuth(handleGetMyStories)],
  ["DELETE", /^\/me\/stories\/([^/]+)$/, withAuth(handleDeleteStory)],
  ["GET", /^\/stories$/, handleGetStories],
  ["GET", /^\/moderation\/stories$/, withModAck(handleGetModerationStories)],
  ["POST", /^\/moderation\/stories\/([^/]+)$/, withModAck(handlePostModerationStory)],
  ["POST", /^\/me\/needs\/claim$/, withAuth(handlePostNeedClaim)],
  ["GET", /^\/missing$/, handleGetMissing],
  ["POST", /^\/me\/missing\/presign$/, withAuth(handlePostMissingPresign)],
  ["PUT", /^\/me\/missing\/([^/]+)$/, withAuth(handlePutMissing)],
  ["DELETE", /^\/me\/missing\/([^/]+)$/, withAuth(handleDeleteMissing)],
  ["GET", /^\/admin\/users\/lookup$/, withAuth(handleAdminUsersLookup)],
  ["GET", /^\/admin\/users$/, withAuth(handleAdminUsersList)],
  ["GET", /^\/admin\/stats$/, withAuth(handleAdminStats)],
  ["GET", /^\/admin\/climate$/, withAuth(handleGetAdminClimate)],
  ["GET", /^\/admin\/incidents$/, withAuth(handleGetAdminIncidents)],
  ["POST", /^\/admin\/incidents$/, withAuth(handlePostAdminIncident)],
  ["POST", /^\/admin\/incidents\/([^/]+)\/publish$/, withAuth(handlePublishIncident)],
  ["POST", /^\/admin\/incidents\/([^/]+)\/archive$/, withAuth(handleArchiveIncident)],
  ["POST", /^\/admin\/incidents\/([^/]+)\/edit$/, withAuth(handleEditIncident)],
  ["POST", /^\/admin\/incidents\/([^/]+)\/approve$/, withAuth(handleApproveIncident)],
  ["POST", /^\/admin\/incidents\/([^/]+)\/reject$/, withAuth(handleRejectIncident)],
  ["GET", /^\/incidents$/, handleGetIncidents],
  ["POST", /^\/incidents\/request$/, withAuth(handlePostIncidentRequest)],
  ["GET", /^\/audit$/, handleGetAudit],
  ["POST", /^\/needs\/media\/presign$/, handlePostNeedsMediaPresign],
  ["POST", /^\/needs$/, handlePostNeeds],
  ["GET", /^\/needs$/, handleGetNeeds],
  ["GET", /^\/status\/(.*)$/, (event, opts, ref) => {
    if (!ref) throw err(400, "refCode required");
    return handleGetStatus(event, opts, ref);
  }],
  ["POST", /^\/needs\/([^/]+)\/renew$/, handlePostRenew],
  ["POST", /^\/offers$/, withAuth(handlePostOffers)],
  ["GET", /^\/offers$/, handleGetOffers],
  ["POST", /^\/offers\/([^/]+)\/status$/, withModAck(handlePostOfferStatus)],
  ["POST", /^\/offers\/([^/]+)\/edit$/, withModAck(handlePostOfferEdit)],
  ["GET", /^\/moderation\/queue$/, withModAck(handleGetModerationQueue)],
  ["POST", /^\/moderation\/([^/]+)\/claim$/, withModAck(handlePostModerationClaim)],
  ["POST", /^\/moderation\/([^/]+)\/release$/, withModAck(handlePostModerationRelease)],
  ["POST", /^\/moderation\/([^/]+)$/, withModAck(handlePostModeration)],
  ["POST", /^\/needs\/([^/]+)\/status$/, withModAck(handlePostNeedStatus)],
  ["POST", /^\/needs\/([^/]+)\/edit$/, withModAck(handlePostNeedEdit)],
  ["POST", /^\/needs\/([^/]+)\/group$/, withAuth(handlePostGroup)],
  ["POST", /^\/needs\/([^/]+)\/group\/join$/, withAuth(handlePostGroupJoin)],
  ["POST", /^\/needs\/([^/]+)\/group\/items$/, withAuth(handlePostGroupItem)],
  ["POST", /^\/needs\/([^/]+)\/group\/items\/([^/]+)\/claim$/, withAuth(handlePostGroupItemClaim)],
  ["POST", /^\/needs\/([^/]+)\/group\/items\/([^/]+)\/release$/, withAuth(handlePostGroupItemRelease)],
  ["POST", /^\/needs\/([^/]+)\/group\/items\/([^/]+)\/done$/, withAuth(handlePostGroupItemDone)],
  ["POST", /^\/claims\/([^/]+)\/redeem$/, withModAck(handleRedeem)],
  ["POST", /^\/claims\/sync$/, withModAck(handleSync)],
  ["GET", /^\/claims\/print$/, withModAck(handlePrint)],
  ["GET", /^\/ledger$/, handleLedger],
  ["POST", /^\/needs\/([^/]+)\/flag$/, handlePostFlag],
  ["GET", /^\/moderation\/flags$/, withModAck(handleGetFlags)],
  ["POST", /^\/projects$/, handlePostProject],
  ["GET", /^\/projects$/, handleGetProjects],
  ["GET", /^\/projects\/([^/]+)$/, handleGetProject],
  ["POST", /^\/projects\/([^/]+)\/photos\/presign$/, handlePostPresign],
  ["POST", /^\/projects\/([^/]+)\/photos$/, handlePostPhoto],
  ["POST", /^\/projects\/([^/]+)\/updates$/, handlePostUpdate],
  ["GET", /^\/moderation\/projects$/, withModAck(handleGetModerationProjects)],
  ["POST", /^\/moderation\/projects\/([^/]+)\/updates\/([^/]+)$/, withModAck(handlePostModerationUpdate)],
  ["POST", /^\/moderation\/projects\/([^/]+)$/, withModAck(handlePostModerationProject)],
  ["GET", /^\/dispatches$/, handleGetDispatches],
  ["POST", /^\/dispatches\/([^/]+)\/view$/, handlePostArticleView],
  ["POST", /^\/dispatches\/([^/]+)\/share$/, handlePostArticleShare],
  ["POST", /^\/dispatches\/([^/]+)\/like$/, withOptionalAuth(handlePostArticleLike)],
  ["POST", /^\/climate\/messages$/, handlePostClimateMessage],
  ["GET", /^\/climate\/messages$/, handleGetClimateMessages],
  ["POST", /^\/climate\/downloads$/, handlePostClimateDownload],
  ["GET", /^\/moderation\/dispatches$/, withModAck(handleGetModerationDispatches)],
  ["POST", /^\/moderation\/dispatches\/([^/]+)$/, withModAck(handlePostModerationDispatch)],
  ["GET", /^\/dispatches\/([^/]+)$/, handleGetDispatch],
  ["POST", /^\/admin\/users\/([^/]+)\/role$/, withAuth(handleAdminUsersRole)],
];

export async function route(event, ctx) {
  const method = (event.requestContext?.http?.method ?? event.requestContext?.httpMethod ?? event.httpMethod ?? "GET").toUpperCase();
  const rawPathFull = event.rawPath ?? event.requestContext?.http?.path ?? event.path ?? "/";
  const path = rawPathFull.split("?")[0];

  if (method === "OPTIONS") return { statusCode: 204, headers: {}, body: "" };
  const res = await dispatch(routes, method, path, event, ctx);
  if (res) return res;
  const orgRes = await routeOrgs(method, path, event, ctx);
  if (orgRes) return orgRes;
  return json(404, { error: "Not Found" });
}
