import { json, err } from "./lib/http.js";
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
  handleGetDashboard, handlePostNeedClaim, handlePostMissingPresign, handlePutMissing, handleDeleteMissing,
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

export async function route(event, ctx) {
  const { getDdb, env, fetchJwks, fetchImpl } = ctx;
  const method = (event.requestContext?.http?.method ?? event.requestContext?.httpMethod ?? event.httpMethod ?? "GET").toUpperCase();
  const rawPathFull = event.rawPath ?? event.requestContext?.http?.path ?? event.path ?? "/";
  const path = rawPathFull.split("?")[0];

  if (method === "OPTIONS") return { statusCode: 204, headers: {}, body: "" };
  if (method === "GET" && path === "/health") return json(200, { ok: true });
  if (method === "POST" && path === "/auth/exchange") return await handleAuthExchange(event, { env, fetchImpl });
  if (method === "POST" && path === "/auth/refresh") return await handleAuthRefresh(event, { env, fetchImpl });
  if (method === "GET" && path === "/me") return await handleMe(event, { fetchJwks, getDdb, env, fetchImpl });
  if (method === "POST" && path === "/me/ack-guidelines") return await handleAckGuidelines(event, { fetchJwks, getDdb, env });
  if (method === "POST" && path === "/me/districts") return await handleSetMyDistricts(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/me/dashboard") return await handleGetDashboard(event, { fetchJwks, getDdb, env });
  if (method === "POST" && path === "/me/articles") return await handlePostArticle(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/me/articles") return await handleGetMyArticles(event, { fetchJwks, getDdb, env });
  if (method === "POST" && path === "/me/articles/media/presign") return await handlePostArticlePresign(event, { fetchJwks, getDdb, env, fetchImpl });
  if (method === "POST" && /^\/me\/articles\/[^/]+\/submit$/.test(path)) {
    return await handleSubmitArticle(event, { fetchJwks, getDdb, env }, decodeURIComponent(path.split("/")[3]));
  }
  if (method === "PUT" && /^\/me\/articles\/[^/]+$/.test(path)) {
    return await handlePutArticle(event, { fetchJwks, getDdb, env }, decodeURIComponent(path.split("/")[3]));
  }
  if (method === "DELETE" && /^\/me\/articles\/[^/]+$/.test(path)) {
    return await handleDeleteArticle(event, { fetchJwks, getDdb, env }, decodeURIComponent(path.split("/")[3]));
  }
  if (method === "GET" && /^\/me\/articles\/[^/]+$/.test(path)) {
    return await handleGetMyArticle(event, { fetchJwks, getDdb, env }, decodeURIComponent(path.split("/")[3]));
  }
  if (method === "POST" && path === "/me/stories") return await handlePostStory(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/me/stories") return await handleGetMyStories(event, { fetchJwks, getDdb, env });
  if (method === "DELETE" && /^\/me\/stories\/[^/]+$/.test(path)) {
    return await handleDeleteStory(event, { fetchJwks, getDdb, env }, decodeURIComponent(path.split("/")[3]));
  }
  if (method === "GET" && path === "/stories") return await handleGetStories(event, { getDdb, env });
  if (method === "GET" && path === "/moderation/stories") return await handleGetModerationStories(event, { fetchJwks, getDdb, env });
  if (method === "POST" && /^\/moderation\/stories\/[^/]+$/.test(path)) {
    return await handlePostModerationStory(event, { fetchJwks, getDdb, env }, decodeURIComponent(path.split("/")[3]));
  }
  if (method === "POST" && path === "/me/needs/claim") return await handlePostNeedClaim(event, { fetchJwks, getDdb, env });
  if (method === "POST" && path === "/me/missing/presign") return await handlePostMissingPresign(event, { fetchJwks, getDdb, env, fetchImpl });
  if (method === "PUT" && /^\/me\/missing\/[^\/]+$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[3]);
    return await handlePutMissing(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "DELETE" && /^\/me\/missing\/[^\/]+$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[3]);
    return await handleDeleteMissing(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "GET" && path === "/admin/users/lookup") return await handleAdminUsersLookup(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/admin/users") return await handleAdminUsersList(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/admin/stats") return await handleAdminStats(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/admin/climate") return await handleGetAdminClimate(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/admin/incidents") return await handleGetAdminIncidents(event, { fetchJwks, getDdb, env });
  if (method === "POST" && path === "/admin/incidents") return await handlePostAdminIncident(event, { fetchJwks, getDdb, env });
  if (method === "POST" && /^\/admin\/incidents\/[^/]+\/(publish|archive)$/.test(path)) {
    const parts = path.split("/");
    const incidentId = decodeURIComponent(parts[3]);
    if (parts[4] === "publish") return await handlePublishIncident(event, { fetchJwks, getDdb, env }, incidentId);
    return await handleArchiveIncident(event, { fetchJwks, getDdb, env }, incidentId);
  }
  if (method === "POST" && /^\/admin\/incidents\/[^/]+\/edit$/.test(path)) {
    const incidentId = decodeURIComponent(path.split("/")[3]);
    return await handleEditIncident(event, { fetchJwks, getDdb, env }, incidentId);
  }
  if (method === "POST" && /^\/admin\/incidents\/[^/]+\/(approve|reject)$/.test(path)) {
    const parts = path.split("/");
    const incidentId = decodeURIComponent(parts[3]);
    if (parts[4] === "approve") return await handleApproveIncident(event, { fetchJwks, getDdb, env }, incidentId);
    return await handleRejectIncident(event, { fetchJwks, getDdb, env }, incidentId);
  }
  if (method === "GET" && path === "/incidents") return await handleGetIncidents(event, { getDdb, env });
  if (method === "POST" && path === "/incidents/request") return await handlePostIncidentRequest(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/audit") return await handleGetAudit(event, { getDdb, env });
  if (method === "POST" && path === "/needs/media/presign") return await handlePostNeedsMediaPresign(event, { env, fetchImpl });
  if (method === "POST" && path === "/needs") return await handlePostNeeds(event, { getDdb, env, fetchJwks });
  if (method === "GET" && path === "/needs") return await handleGetNeeds(event, { getDdb, env });
  if (method === "GET" && path.startsWith("/status/")) {
    const ref = decodeURIComponent(path.slice("/status/".length));
    if (!ref) throw err(400, "refCode required");
    return await handleGetStatus(event, { getDdb, env }, ref);
  }
  if (method === "POST" && /^\/needs\/[^\/]+\/renew$/.test(path)) {
    const ref = decodeURIComponent(path.split("/")[2]);
    return await handlePostRenew(event, { getDdb, env }, ref);
  }
  if (method === "POST" && path === "/offers") return await handlePostOffers(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/offers") return await handleGetOffers(event, { getDdb, env });
  if (method === "POST" && /^\/offers\/[^\/]+\/status$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostOfferStatus(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "POST" && /^\/offers\/[^\/]+\/edit$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostOfferEdit(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "GET" && path === "/moderation/queue") return await handleGetModerationQueue(event, { fetchJwks, getDdb, env });
  if (method === "POST" && /^\/moderation\/[^\/]+\/claim$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostModerationClaim(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "POST" && /^\/moderation\/[^\/]+\/release$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostModerationRelease(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "POST" && /^\/moderation\/[^\/]+$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostModeration(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "POST" && /^\/needs\/[^\/]+\/status$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostNeedStatus(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "POST" && /^\/needs\/[^\/]+\/edit$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostNeedEdit(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "POST" && /^\/needs\/[^\/]+\/group$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostGroup(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "POST" && /^\/needs\/[^\/]+\/group\/join$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostGroupJoin(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "POST" && /^\/needs\/[^\/]+\/group\/items$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostGroupItem(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "POST" && /^\/needs\/[^\/]+\/group\/items\/[^\/]+\/claim$/.test(path)) {
    const parts = path.split("/");
    return await handlePostGroupItemClaim(event, { fetchJwks, getDdb, env }, decodeURIComponent(parts[2]), decodeURIComponent(parts[5]));
  }
  if (method === "POST" && /^\/needs\/[^\/]+\/group\/items\/[^\/]+\/release$/.test(path)) {
    const parts = path.split("/");
    return await handlePostGroupItemRelease(event, { fetchJwks, getDdb, env }, decodeURIComponent(parts[2]), decodeURIComponent(parts[5]));
  }
  if (method === "POST" && /^\/needs\/[^\/]+\/group\/items\/[^\/]+\/done$/.test(path)) {
    const parts = path.split("/");
    return await handlePostGroupItemDone(event, { fetchJwks, getDdb, env }, decodeURIComponent(parts[2]), decodeURIComponent(parts[5]));
  }
  if (method === "POST" && /^\/claims\/[^\/]+\/redeem$/.test(path)) {
    const code = decodeURIComponent(path.split("/")[2]);
    return await handleRedeem(event, { fetchJwks, getDdb, env }, code);
  }
  if (method === "POST" && path === "/claims/sync") return await handleSync(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/claims/print") return await handlePrint(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/ledger") return await handleLedger(event, { getDdb, env });
  if (method === "POST" && /^\/needs\/[^\/]+\/flag$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostFlag(event, { getDdb, env }, id);
  }
  if (method === "GET" && path === "/moderation/flags") return await handleGetFlags(event, { fetchJwks, getDdb, env });
  if (method === "POST" && path === "/projects") return await handlePostProject(event, { getDdb, env });
  if (method === "GET" && path === "/projects") return await handleGetProjects(event, { getDdb, env });
  if (method === "GET" && /^\/projects\/[^\/]+$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handleGetProject(event, { getDdb, env }, id);
  }
  if (method === "POST" && /^\/projects\/[^\/]+\/photos\/presign$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostPresign(event, { getDdb, env, fetchImpl, fetchJwks }, id);
  }
  if (method === "POST" && /^\/projects\/[^\/]+\/photos$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostPhoto(event, { getDdb, env, fetchImpl, fetchJwks }, id);
  }
  if (method === "POST" && /^\/projects\/[^\/]+\/updates$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostUpdate(event, { getDdb, env, fetchImpl, fetchJwks }, id);
  }
  if (method === "GET" && path === "/moderation/projects") return await handleGetModerationProjects(event, { fetchJwks, getDdb, env });
  if (method === "POST" && /^\/moderation\/projects\/[^\/]+\/updates\/[^\/]+$/.test(path)) {
    const parts = path.split("/");
    const id = decodeURIComponent(parts[3]);
    const updateId = decodeURIComponent(parts[5]);
    return await handlePostModerationUpdate(event, { fetchJwks, getDdb, env }, id, updateId);
  }
  if (method === "POST" && /^\/moderation\/projects\/[^\/]+$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[3]);
    return await handlePostModerationProject(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "GET" && path === "/dispatches") return await handleGetDispatches(event, { getDdb, env });
  if (method === "POST" && /^\/dispatches\/[^/]+\/(view|share|like)$/.test(path)) {
    const parts = path.split("/");
    const id = decodeURIComponent(parts[2]);
    if (parts[3] === "view") return await handlePostArticleView(event, { getDdb, env }, id);
    if (parts[3] === "share") return await handlePostArticleShare(event, { getDdb, env }, id);
    return await handlePostArticleLike(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "POST" && path === "/climate/messages") return await handlePostClimateMessage(event, { getDdb, env });
  if (method === "GET" && path === "/climate/messages") return await handleGetClimateMessages(event, { getDdb, env });
  if (method === "POST" && path === "/climate/downloads") return await handlePostClimateDownload(event, { getDdb, env });
  if (method === "GET" && path === "/moderation/dispatches") return await handleGetModerationDispatches(event, { fetchJwks, getDdb, env });
  if (method === "POST" && /^\/moderation\/dispatches\/[^\/]+$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[3]);
    return await handlePostModerationDispatch(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "GET" && /^\/dispatches\/[^\/]+$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handleGetDispatch(event, { getDdb, env }, id);
  }
  if (method === "POST" && /^\/admin\/users\/[^\/]+\/role$/.test(path)) {
    const parts = path.split("/");
    const sub = decodeURIComponent(parts[3]);
    return await handleAdminUsersRole(event, { fetchJwks, getDdb, env }, sub);
  }
  const orgRes = await routeOrgs(method, path, event, { fetchJwks, getDdb, env });
  if (orgRes) return orgRes;
  return json(404, { error: "Not Found" });
}
