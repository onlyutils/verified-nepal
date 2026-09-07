import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { listNeedsForHandling } from "./need.js";
import { getDonation } from "./donation.js";
import { listPointers } from "./mine.js";
import { needTimeline } from "../views/need-timeline.js";

export const ACTIVITY_SECTIONS = ["registered", "handling", "groups", "donations"];

function time(value) {
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestTimelineAt(need, donation) {
  return need ? needTimeline(need, { donation }).reduce((latest, step) => Math.max(latest, time(step.at)), 0) : 0;
}

function itemTime(item, need, donation) {
  return Math.max(time(item?.updatedAt), time(item?.createdAt), latestTimelineAt(need, donation));
}

export async function getActivity(ddb, tableName, sub, lastSeen = {}) {
  const pointers = await listPointers(ddb, tableName, sub);
  const registered = [];
  const groups = [];
  const donations = [];
  for (const pointer of pointers) {
    if (pointer.kind === "NEED" || pointer.kind === "GROUP") {
      const item = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `NEED#${pointer.id}`, SK: "META" } }))).Item;
      if (!item) continue;
      if (pointer.kind === "NEED") registered.push({ item, donation: item.donationRef ? await getDonation(ddb, tableName, item.donationRef) : undefined });
      else groups.push({ item, donation: item.donationRef ? await getDonation(ddb, tableName, item.donationRef) : undefined });
    } else if (pointer.kind === "DONATION") {
      const item = await getDonation(ddb, tableName, pointer.id);
      if (!item) continue;
      const need = item.needId
        ? (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `NEED#${item.needId}`, SK: "META" } }))).Item
        : undefined;
      donations.push({ item, need });
    }
  }
  const handling = (await listNeedsForHandling(ddb, tableName, sub)).map((item) => ({ item }));
  const counts = {
    registered: registered.filter(({ item, donation }) => itemTime(item, item, donation) > time(lastSeen.registered)).length,
    handling: handling.filter(({ item }) => itemTime(item, item) > time(lastSeen.handling)).length,
    groups: groups.filter(({ item, donation }) => itemTime(item, item, donation) > time(lastSeen.groups)).length,
    donations: donations.filter(({ item, need }) => itemTime(item, need, item) > time(lastSeen.donations)).length,
  };
  return { lastSeen, counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
}
