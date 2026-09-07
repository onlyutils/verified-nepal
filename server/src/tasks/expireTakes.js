import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { TAKE_TTL_DAYS } from "../constants.js";
import { setNeedStatus } from "../models/need.js";
import { deleteHandlingPointer } from "../models/mine.js";
import { deleteOrgNeed } from "../models/orgNeed.js";
import { recordAudit, getTargetLabelForAudit } from "../models/audit.js";
import { notifyRequester } from "../lib/notify.js";

/** Hourly: return matched needs whose helper/group/org take is older than TAKE_TTL_DAYS to the open pool. */
export async function expireTakes(ddb, tableName, { now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - TAKE_TTL_DAYS * 86400000).toISOString();
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new QueryCommand({ TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk", ExpressionAttributeValues: { ":pk": "NEED#matched" }, ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}) }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  const expired = [];
  for (const need of items) {
    const h = need.handledBy;
    if (!h?.at || h.at > cutoff) continue; // moderator offer-matches have no handledBy
    const label = h.label || h.orgName || "";
    const releasedNeed = { ...need };
    delete releasedNeed.handledBy;
    try {
      await setNeedStatus(ddb, tableName, { need: releasedNeed, status: "published", expectedStatus: "matched" });
    } catch (e) {
      if (e.status === 409) continue; // delivered or released concurrently
      throw e;
    }
    if (h.kind === "helper" && h.sub) await deleteHandlingPointer(ddb, tableName, { sub: h.sub, needId: need.id });
    if (h.orgId) await deleteOrgNeed(ddb, tableName, { orgId: h.orgId, needId: need.id });
    await recordAudit(ddb, tableName, { actorSub: "system", actorName: "system", action: "take_expired", targetType: "NEED", targetId: releasedNeed.id, targetLabel: getTargetLabelForAudit("NEED", releasedNeed), reason: `take by ${label} older than ${TAKE_TTL_DAYS} days` });
    await notifyRequester(ddb, tableName, releasedNeed, "expired", { label });
    expired.push(releasedNeed.id);
  }
  return { scanned: items.length, expired };
}
