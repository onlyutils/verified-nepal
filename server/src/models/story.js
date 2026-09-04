import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { listPointers } from "./mine.js";
import { listUserMemberships } from "./org.js";
import { listOrgCenterPointers } from "./center.js";
import { listAllEntries } from "./goods.js";

export const STORY_ROLES = ["needy", "helper", "org"];

/**
 * Who this person may tell a story as: "needy" (a request of theirs was fulfilled),
 * "helper" (an offer was matched or they finished a group item), "org" (a member of an
 * organization whose center has recorded a distribution). null = nothing to tell yet.
 * ponytail: one read per pointer/center; people own tens of items, not thousands.
 */
export async function storyRole(ddb, tableName, sub) {
  let helper = false;
  for (const p of await listPointers(ddb, tableName, sub)) {
    if (!["NEED", "OFFER", "GROUP"].includes(p.kind)) continue;
    const pk = p.kind === "GROUP" ? `NEED#${p.id}` : `${p.kind}#${p.id}`;
    const item = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: pk, SK: "META" } }))).Item;
    if (!item) continue;
    if (p.kind === "NEED" && item.status === "fulfilled") return "needy";
    if (p.kind === "OFFER" && ["matched", "fulfilled"].includes(item.status)) helper = true;
    if (p.kind === "GROUP" && Object.values(item.groupItems || {}).some((it) => it.claimedBy === sub && it.status === "done")) helper = true;
  }
  if (helper) return "helper";
  for (const m of await listUserMemberships(ddb, tableName, sub)) {
    for (const c of await listOrgCenterPointers(ddb, tableName, m.orgId)) {
      const centerId = c.centerId || String(c.SK).replace(/^CENTER#/, "");
      if ((await listAllEntries(ddb, tableName, centerId)).some((e) => e.entryType === "distribution")) return "org";
    }
  }
  return null;
}
