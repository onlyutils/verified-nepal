import { randomUUID } from "node:crypto";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { err } from "../lib/http.js";
import { generateUpdateCode, hashUpdateCode } from "../lib/format.js";
import { PUBLIC_PROJECT_STATUSES, PROJECT_ALL_STATUSES } from "../constants.js";

export async function createProject(ddb, tableName, {
  titleObj, descObj, type, districtClean, ward, locationTextClean, costClean,
  committeeName, contactName, phone, email, bankName, accountName, accountNumber, esewaId, khaltiId,
  incidentId,
}) {
  const id = randomUUID();
  const updateCode = generateUpdateCode();
  const updateCodeHash = hashUpdateCode(updateCode);
  const createdAt = new Date().toISOString();
  const status = "pending";
  const item = {
    PK: `PROJECT#${id}`,
    SK: "META",
    id,
    incidentId,
    title: titleObj,
    description: descObj,
    type,
    district: districtClean,
    ward,
    locationText: locationTextClean,
    costEstimateNpr: costClean,
    committee: { name: committeeName, contactName, phone, email, bank: { bankName, accountName, accountNumber }, esewaId, khaltiId, verified: false },
    photos: [],
    status,
    updateCodeHash,
    createdAt,
    gsi1pk: `PROJECT#${incidentId}#${districtClean}#${status}`,
    gsi1sk: createdAt,
    gsi2pk: `PROJECT#${status}`,
    gsi2sk: createdAt,
  };
  if (!item.committee.esewaId) delete item.committee.esewaId;
  if (!item.committee.khaltiId) delete item.committee.khaltiId;
  if (!item.committee.email) delete item.committee.email;
  const pcode = { PK: `PCODE#${updateCodeHash}`, SK: "META", type: "PCODE", projectId: id, createdAt };
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  await ddb.send(new PutCommand({ TableName: tableName, Item: pcode }));
  return { id, updateCode };
}

export async function getProjectById(ddb, tableName, projectId) {
  return (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `PROJECT#${projectId}`, SK: "META" } }))).Item;
}

export async function putProject(ddb, tableName, proj) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: proj }));
}

export async function listPublicProjects(ddb, tableName, { incidentId, district, status }) {
  let items = [];
  if (district && status) {
    const pk = `PROJECT#${incidentId}#${district}#${status}`;
    const res = await ddb.send(new QueryCommand({ TableName: tableName, IndexName: "GSI1", KeyConditionExpression: "gsi1pk = :pk", ExpressionAttributeValues: { ":pk": pk }, ScanIndexForward: false }));
    if (res.Items) items.push(...res.Items);
  } else if (district && !status) {
    for (const s of PUBLIC_PROJECT_STATUSES) {
      const pk = `PROJECT#${incidentId}#${district}#${s}`;
      const res = await ddb.send(new QueryCommand({ TableName: tableName, IndexName: "GSI1", KeyConditionExpression: "gsi1pk = :pk", ExpressionAttributeValues: { ":pk": pk }, ScanIndexForward: false }));
      if (res.Items) items.push(...res.Items);
    }
  } else if (!district && status) {
    const pk = `PROJECT#${status}`;
    const res = await ddb.send(new QueryCommand({ TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk", ExpressionAttributeValues: { ":pk": pk }, ScanIndexForward: false }));
    if (res.Items) items.push(...res.Items.filter((item) => item.incidentId === incidentId));
  } else {
    for (const s of PUBLIC_PROJECT_STATUSES) {
      const pk = `PROJECT#${s}`;
      const res = await ddb.send(new QueryCommand({ TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk", ExpressionAttributeValues: { ":pk": pk }, ScanIndexForward: false }));
      if (res.Items) items.push(...res.Items.filter((item) => item.incidentId === incidentId));
    }
  }
  items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return items;
}

export async function listProjectUpdates(ddb, tableName, projectId, { scanForward = true } = {}) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `PROJECT#${projectId}`, ":prefix": "UPDATE#" },
    ScanIndexForward: scanForward,
  }));
  return res.Items || [];
}

export async function addPhotoToProject(ddb, tableName, proj, { fileId, url, caption, status }) {
  const photo = { fileId, url, status };
  if (caption) photo.caption = caption;
  proj.photos = Array.isArray(proj.photos) ? proj.photos : [];
  proj.photos.push(photo);
  await ddb.send(new PutCommand({ TableName: tableName, Item: proj }));
  return photo;
}

export async function addProjectUpdate(ddb, tableName, { projectId, text, photos, spentNpr }) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const sk = `UPDATE#${createdAt}#${id.slice(0, 8)}`;
  const item = { PK: `PROJECT#${projectId}`, SK: sk, type: "UPDATE", id, projectId, text, photos, status: "pending", createdAt };
  if (spentNpr !== undefined) item.spentNpr = spentNpr;
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  return { updateId: id };
}

export async function listModerationProjects(ddb, tableName) {
  let all = [];
  for (const s of PROJECT_ALL_STATUSES) {
    const pk = `PROJECT#${s}`;
    const res = await ddb.send(new QueryCommand({ TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk", ExpressionAttributeValues: { ":pk": pk }, ScanIndexForward: true }));
    if (res.Items) all.push(...res.Items);
  }
  all.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  return all;
}

export async function moderateProject(ddb, tableName, { proj, action, reason, status, fileId }) {
  let auditAction = action;
  if (action === "verify-committee") {
    proj.committee.verified = true;
    await ddb.send(new PutCommand({ TableName: tableName, Item: proj }));
  } else if (action === "publish") {
    if (!proj.committee.verified) throw err(400, "committee must be verified before publish");
    if (proj.status !== "pending") throw err(400, "only pending projects can be published");
    proj.status = "published";
    proj.gsi1pk = `PROJECT#${proj.incidentId}#${proj.district}#published`;
    proj.gsi1sk = proj.createdAt;
    proj.gsi2pk = "PROJECT#published";
    proj.gsi2sk = proj.createdAt;
    await ddb.send(new PutCommand({ TableName: tableName, Item: proj }));
  } else if (action === "reject") {
    if (!reason || typeof reason !== "string" || !reason.trim() || reason.trim().length < 5) throw err(400, "reason required for reject");
    proj.status = "rejected";
    proj.gsi1pk = `PROJECT#${proj.incidentId}#${proj.district}#rejected`;
    proj.gsi1sk = proj.createdAt;
    proj.gsi2pk = "PROJECT#rejected";
    proj.gsi2sk = proj.createdAt;
    if (reason) proj.rejectionReason = reason.trim();
    await ddb.send(new PutCommand({ TableName: tableName, Item: proj }));
  } else if (action === "set-status") {
    if (!status || typeof status !== "string" || !PROJECT_ALL_STATUSES.includes(status)) throw err(400, `status must be one of ${PROJECT_ALL_STATUSES.join(",")}`);
    if (status === "published" && !proj.committee.verified) throw err(400, "committee must be verified before publish");
    proj.status = status;
    proj.gsi1pk = `PROJECT#${proj.incidentId}#${proj.district}#${status}`;
    proj.gsi1sk = proj.createdAt;
    proj.gsi2pk = `PROJECT#${status}`;
    proj.gsi2sk = proj.createdAt;
    await ddb.send(new PutCommand({ TableName: tableName, Item: proj }));
    auditAction = `set-status:${status}`;
  } else if (action === "publish-photo") {
    if (!fileId || typeof fileId !== "string" || !fileId.trim()) throw err(400, "fileId required");
    const fid = fileId.trim();
    const photos = Array.isArray(proj.photos) ? proj.photos : [];
    const p = photos.find((x) => x.fileId === fid);
    if (!p) throw err(404, "photo not found");
    p.status = "published";
    await ddb.send(new PutCommand({ TableName: tableName, Item: proj }));
  } else if (action === "reject-photo") {
    if (!fileId || typeof fileId !== "string" || !fileId.trim()) throw err(400, "fileId required");
    const fid = fileId.trim();
    const photos = Array.isArray(proj.photos) ? proj.photos : [];
    const idx = photos.findIndex((x) => x.fileId === fid);
    if (idx === -1) throw err(404, "photo not found");
    photos.splice(idx, 1);
    proj.photos = photos;
    await ddb.send(new PutCommand({ TableName: tableName, Item: proj }));
  }
  return { status: proj.status, auditAction };
}

export async function moderateProjectUpdate(ddb, tableName, { target, action, reason }) {
  if (action === "publish") {
    target.status = "published";
    await ddb.send(new PutCommand({ TableName: tableName, Item: target }));
  } else {
    target.status = "rejected";
    if (reason) target.rejectionReason = String(reason).trim();
    await ddb.send(new PutCommand({ TableName: tableName, Item: target }));
  }
  return { status: target.status };
}
