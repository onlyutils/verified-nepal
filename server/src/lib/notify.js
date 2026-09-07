import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { maskName } from "./format.js";
import { getSmsSiteBase, sendSms } from "./sms.js";

export const MAX_EVENTS = 20;
export const EVENTS = ["taken", "released", "delivered", "expired"];

const SMS_COPY = {
  taken: (label) => `Your request was taken by ${label} / तपाईंको अनुरोध ${label} ले लिनुभएको छ।`,
  released: (label) => `Your request was released by ${label} / तपाईंको अनुरोध ${label} बाट फिर्ता गरिएको छ।`,
  delivered: (label) => `Your request was delivered by ${label} / तपाईंको अनुरोध ${label} ले पुर्‍याउनुभएको छ।`,
  expired: (label) => `The take by ${label} expired / ${label} ले लिएको अनुरोधको समय सकिएको छ।`,
};

function buildSmsText(event, label, refCode) {
  const maskedLabel = maskName(label || "") || "VerifiedNepal";
  const statusUrl = `${getSmsSiteBase()}/status/${encodeURIComponent(refCode || "")}`;
  return `${SMS_COPY[event](maskedLabel)} Status: ${statusUrl} स्थिति: ${statusUrl}`;
}

/** Record a requester-visible event on the need (status page + /me timeline). */
export async function notifyRequester(ddb, tableName, need, event, { label } = {}) {
  if (!EVENTS.includes(event)) return;
  try {
    const current = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: need.PK, SK: need.SK } }))).Item;
    if (!current) return;
    const entry = { event, at: new Date().toISOString(), ...(label ? { label } : {}) };
    const events = [...(current.events || []), entry].slice(-MAX_EVENTS);
    await ddb.send(new PutCommand({ TableName: tableName, Item: { ...current, events }, ConditionExpression: "attribute_exists(PK)" }));
    const sms = await sendSms({
      to: need.registrant?.phone || need.beneficiary?.phone,
      text: buildSmsText(event, label, current.refCode || need.refCode),
    });
    if (sms.sent) {
      entry.smsSentAt = new Date().toISOString();
      const sentEvents = [...events.slice(0, -1), entry];
      await ddb.send(new PutCommand({ TableName: tableName, Item: { ...current, events: sentEvents }, ConditionExpression: "attribute_exists(PK)" }));
      need.events = sentEvents;
    } else {
      need.events = events;
    }
  } catch (e) {
    console.error("notifyRequester failed", { needId: need?.id, event, error: e?.message });
  }
}
