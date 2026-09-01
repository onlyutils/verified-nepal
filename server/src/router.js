import { json, err } from "./lib/http.js";
import { routeOrgs } from "./routes/orgRoutes.js";
import { handleAuthExchange, handleAuthRefresh, handleMe, handleAckGuidelines } from "./controllers/authController.js";
import { handleAdminUsersLookup, handleAdminUsersList, handleAdminStats, handleAdminUsersRole } from "./controllers/adminController.js";
import { handleGetAudit } from "./controllers/auditController.js";
import {
  handlePostNeeds, handleGetNeeds, handleGetStatus, handlePostRenew,
  handlePostNeedStatus, handlePostFlag, handleGetFlags,
} from "./controllers/needController.js";
import { handlePostOffers, handleGetOffers } from "./controllers/offerController.js";
import { handleGetModerationQueue, handlePostModeration } from "./controllers/moderationController.js";
import { handleRedeem, handleSync, handlePrint, handleLedger } from "./controllers/claimController.js";
import {
  handlePostProject, handleGetProjects, handleGetProject, handlePostPresign, handlePostPhoto,
  handlePostUpdate, handleGetModerationProjects, handlePostModerationProject, handlePostModerationUpdate,
} from "./controllers/projectController.js";
import {
  handlePostDispatch, handleGetDispatches, handleGetModerationDispatches,
  handlePostModerationDispatch, handleGetDispatch,
} from "./controllers/dispatchController.js";

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
  if (method === "GET" && path === "/admin/users/lookup") return await handleAdminUsersLookup(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/admin/users") return await handleAdminUsersList(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/admin/stats") return await handleAdminStats(event, { fetchJwks, getDdb, env });
  if (method === "GET" && path === "/audit") return await handleGetAudit(event, { getDdb, env });
  if (method === "POST" && path === "/needs") return await handlePostNeeds(event, { getDdb, env });
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
  if (method === "GET" && path === "/moderation/queue") return await handleGetModerationQueue(event, { fetchJwks, getDdb, env });
  if (method === "POST" && /^\/moderation\/[^\/]+$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostModeration(event, { fetchJwks, getDdb, env }, id);
  }
  if (method === "POST" && /^\/needs\/[^\/]+\/status$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2]);
    return await handlePostNeedStatus(event, { fetchJwks, getDdb, env }, id);
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
  if (method === "POST" && path === "/dispatches") return await handlePostDispatch(event, { getDdb, env });
  if (method === "GET" && path === "/dispatches") return await handleGetDispatches(event, { getDdb, env });
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
