import { GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

function put(ddb, tableName, item) {
  return ddb.send(new PutCommand({ TableName: tableName, Item: item }));
}

export function droneOperatorKey(id) { return `DRONEOP#${id}`; }

export async function createDroneOperator(ddb, tableName, fields) {
  const id = fields.id || randomUUID();
  const createdAt = fields.createdAt || new Date().toISOString();
  const item = {
    PK: droneOperatorKey(id), SK: "META", type: "OPERATOR", ...fields, id,
    status: fields.status || "active", createdAt,
    gsi1pk: `DRONEOP#${fields.baseDistrict}`, gsi1sk: createdAt,
    gsi2pk: `DRONEOP#${fields.status || "active"}`, gsi2sk: createdAt,
  };
  await put(ddb, tableName, item);
  return item;
}

export async function getDroneOperator(ddb, tableName, id) {
  const result = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: droneOperatorKey(id), SK: "META" } }));
  return result.Item || null;
}

export async function saveDroneOperator(ddb, tableName, operator) {
  await put(ddb, tableName, operator);
  return operator;
}

export async function listDroneOperators(ddb, tableName, { orgId, status, district } = {}) {
  let items;
  if (status) {
    const result = await ddb.send(new QueryCommand({
      TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk",
      ExpressionAttributeValues: { ":pk": `DRONEOP#${status}` }, ScanIndexForward: false,
    }));
    items = result.Items || [];
  } else {
    const result = await ddb.send(new ScanCommand({ TableName: tableName }));
    items = (result.Items || []).filter((item) => item.type === "OPERATOR");
  }
  return items.filter((item) => item.type === "OPERATOR")
    .filter((item) => !orgId || item.orgId === orgId)
    .filter((item) => !district || item.baseDistrict === district)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function landingSiteKey(id) { return `LZ#${id}`; }

export async function createLandingSite(ddb, tableName, fields) {
  const id = fields.id || randomUUID();
  const createdAt = fields.createdAt || new Date().toISOString();
  const item = {
    PK: landingSiteKey(id), SK: "META", type: "LANDING_SITE", ...fields, id,
    status: fields.status || "active", createdAt,
    gsi1pk: `LZ#${fields.district}`, gsi1sk: createdAt,
  };
  await put(ddb, tableName, item);
  return item;
}

export async function getLandingSite(ddb, tableName, id) {
  const result = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: landingSiteKey(id), SK: "META" } }));
  return result.Item || null;
}

export async function listLandingSites(ddb, tableName, { district, status } = {}) {
  let items;
  if (district) {
    const result = await ddb.send(new QueryCommand({
      TableName: tableName, IndexName: "GSI1", KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": `LZ#${district}` }, ScanIndexForward: false,
    }));
    items = result.Items || [];
  } else {
    const result = await ddb.send(new ScanCommand({ TableName: tableName }));
    items = (result.Items || []).filter((item) => item.type === "LANDING_SITE");
  }
  return items.filter((item) => item.type === "LANDING_SITE")
    .filter((item) => !status || item.status === status)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function payloadRequestKey(id) { return `DRONEREQ#${id}`; }

export async function createPayloadRequest(ddb, tableName, fields) {
  const id = fields.id || randomUUID();
  const createdAt = fields.createdAt || new Date().toISOString();
  const item = {
    PK: payloadRequestKey(id), SK: "META", type: "PAYLOAD_REQUEST", ...fields, id,
    status: fields.status || "open", createdAt, updatedAt: fields.updatedAt || createdAt,
    gsi1pk: `DRONEREQ#${fields.incidentId}`,
    gsi1sk: `${fields.priority === "urgent" ? 0 : 1}#${fields.windowStart}`,
    gsi2pk: `DRONEREQ#${fields.status || "open"}`, gsi2sk: createdAt,
  };
  await put(ddb, tableName, item);
  return item;
}

export async function getPayloadRequest(ddb, tableName, id) {
  const result = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: payloadRequestKey(id), SK: "META" } }));
  return result.Item || null;
}

export async function savePayloadRequest(ddb, tableName, request) {
  await put(ddb, tableName, request);
  return request;
}

export async function listPayloadRequests(ddb, tableName, { status, incidentId } = {}) {
  let items;
  if (status) {
    const result = await ddb.send(new QueryCommand({
      TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk",
      ExpressionAttributeValues: { ":pk": `DRONEREQ#${status}` }, ScanIndexForward: false,
    }));
    items = result.Items || [];
  } else if (incidentId) {
    const result = await ddb.send(new QueryCommand({
      TableName: tableName, IndexName: "GSI1", KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": `DRONEREQ#${incidentId}` }, ScanIndexForward: true,
    }));
    items = result.Items || [];
  } else {
    const result = await ddb.send(new ScanCommand({ TableName: tableName }));
    items = (result.Items || []).filter((item) => item.type === "PAYLOAD_REQUEST");
  }
  return items.filter((item) => item.type === "PAYLOAD_REQUEST")
    .filter((item) => !status || item.status === status)
    .filter((item) => !incidentId || item.incidentId === incidentId)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function missionKey(id) { return `MISSION#${id}`; }

export async function createMission(ddb, tableName, fields) {
  const id = fields.id || randomUUID();
  const createdAt = fields.createdAt || new Date().toISOString();
  const item = {
    PK: missionKey(id), SK: "META", type: "MISSION", ...fields, id,
    status: fields.status || "planned", createdAt,
    gsi1pk: `MISSION#${fields.district}#${new Date(fields.etd).toISOString().slice(0, 10)}`,
    gsi1sk: fields.etd,
  };
  await put(ddb, tableName, item);
  return item;
}

export async function getMission(ddb, tableName, id) {
  const result = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: missionKey(id), SK: "META" } }));
  return result.Item || null;
}

export async function saveMission(ddb, tableName, mission) {
  await put(ddb, tableName, mission);
  return mission;
}

export async function listMissions(ddb, tableName) {
  const result = await ddb.send(new ScanCommand({ TableName: tableName }));
  return (result.Items || []).filter((item) => item.type === "MISSION")
    .sort((a, b) => (a.etd || "").localeCompare(b.etd || ""));
}
