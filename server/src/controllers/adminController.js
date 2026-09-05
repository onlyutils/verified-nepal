import { json, err, getQuery, parseBody, decodeCursor, encodeCursor } from "../lib/http.js";
import { validateString } from "../lib/validate.js";
import { maskEmail } from "../lib/format.js";
import { listUsersByRoles, getEmailPointer, getUserProfile, setUserRole } from "../models/user.js";
import { getAdminStats } from "../models/stats.js";
import { recordAudit } from "../models/audit.js";
import { toAdminUserView } from "../views/user.js";

export async function handleAdminUsersList(event, opts) {
  const { auth } = opts;
  if (auth.role !== "admin") throw err(403, "Forbidden");
  const q = getQuery(event);
  const roleFilter = q.role ? String(q.role).trim() : "";
  const cursorRaw = q.cursor ? String(q.cursor).trim() : "";
  if (roleFilter && !["helper", "moderator", "admin"].includes(roleFilter)) throw err(400, "invalid role");
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const cursorKey = decodeCursor(cursorRaw);
  const roles = roleFilter ? [roleFilter] : ["helper", "moderator", "admin"];
  const all = await listUsersByRoles(ddb, tableName, roles);
  let start = 0;
  if (cursorKey) {
    const idx = all.findIndex((it) => it.PK === cursorKey.PK && it.SK === cursorKey.SK);
    if (idx === -1) throw err(400, "invalid cursor");
    start = idx + 1;
  }
  const limit = 20;
  const sliced = all.slice(start, start + limit);
  const items = sliced.map((u) => toAdminUserView(u, u.PK.replace(/^USER#/, "")));
  const body = { items };
  if (start + limit < all.length) {
    const last = sliced[sliced.length - 1];
    body.cursor = encodeCursor({ PK: last.PK, SK: last.SK });
  }
  return json(200, body);
}

export async function handleAdminUsersLookup(event, opts) {
  const { auth } = opts;
  if (auth.role !== "admin") throw err(403, "Forbidden");
  const q = getQuery(event);
  const emailRaw = q.email ? String(q.email).trim() : "";
  if (!emailRaw) throw err(400, "email required");
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const ptr = await getEmailPointer(ddb, tableName, emailRaw);
  if (!ptr) throw err(404, "not found");
  const sub = ptr.sub;
  const profileRes = await getUserProfile(ddb, tableName, sub);
  const user = profileRes.item;
  if (!user) throw err(404, "not found");
  return json(200, toAdminUserView(user, sub));
}

export async function handleAdminUsersRole(event, opts, targetSub) {
  const { auth } = opts;
  if (auth.role !== "admin") throw err(403, "Forbidden");
  if (auth.payload.sub === targetSub) {
    const bodyTmp = parseBody(event) || {};
    const requestedRole = bodyTmp.role ? String(bodyTmp.role).trim() : "";
    if (["helper", "moderator"].includes(requestedRole) || (requestedRole === "admin" ? false : false)) {
      // self demotion guard: admin cannot demote themselves
      if (requestedRole !== "admin") throw err(403, "self_demotion_not_allowed");
    }
  }
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const role = body.role ? String(body.role).trim() : "";
  if (!["helper", "moderator", "admin"].includes(role)) throw err(400, "role must be helper|moderator|admin");
  let districts = [];
  if (body.districts !== undefined) {
    if (!Array.isArray(body.districts)) throw err(400, "districts must be array");
    districts = body.districts.map((d) => validateString(d, "districts[]", 1, 100));
  }
  const user = await setUserRole(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, targetSub, role, districts });
  const actorName = auth.user?.name || auth.payload.name || "";
  const targetLabel = maskEmail(user.email || "");
  await recordAudit(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, actorName, action: "role.set", targetType: "USER", targetId: targetSub, targetLabel, reason: `role:${role}` });
  return json(200, { role, districts });
}

export async function handleAdminStats(event, opts) {
  const { auth } = opts;
  if (auth.role !== "admin") throw err(403, "Forbidden");
  const stats = await getAdminStats(auth.ddb, auth.tableName);
  return json(200, stats);
}
