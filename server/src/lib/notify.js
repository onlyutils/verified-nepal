import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export const MAX_EVENTS = 20;
export const EVENTS = ["taken", "released", "delivered", "expired"];

/**
 * Record a requester-visible event on the need (status page + /me timeline).
 * TODO(sms): Sparrow SMS to registrant.phone once provisioned — this is the single send point.
 */
export async function notifyRequester(ddb, tableName, need, event, { label } = {}) {
  if (!EVENTS.includes(event)) return;
  try {
    const current = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: need.PK, SK: need.SK } }))).Item;
    if (!current) return;
    const entry = { event, at: new Date().toISOString(), ...(label ? { label } : {}) };
    const events = [...(current.events || []), entry].slice(-MAX_EVENTS);
    await ddb.send(new PutCommand({ TableName: tableName, Item: { ...current, events }, ConditionExpression: "attribute_exists(PK)" }));
    if (need) need.events = events;
  } catch (e) {
    console.error("notifyRequester failed", { needId: need?.id, event, error: e?.message });
  }
}
