#!/usr/bin/env node
// One-time backfill: tags every existing NEED/OFFER/PROJECT item with
// incidentId "bhote-koshi-2026" and rewrites its gsi1pk to the new
// {TYPE}#{incidentId}#{district}#{status} shape, and ensures the
// bhote-koshi-2026 INCIDENT record itself exists (status: active).
// See docs/superpowers/specs/2026-09-04-multi-disaster-generalization-design.md
// "Migration". Dry-run by default — pass --apply to actually write.
//
// Usage:
//   node server/scripts/backfill-incident-id.mjs --table <TableName> [--region ap-south-1] [--apply] [--type NEED|OFFER|PROJECT]

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const INCIDENT_ID = "bhote-koshi-2026";
const TYPES = ["NEED", "OFFER", "PROJECT"];

function parseArgs(argv) {
  const out = { apply: false, types: TYPES };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--table") out.table = argv[++i];
    else if (a === "--region") out.region = argv[++i];
    else if (a === "--type") out.types = [argv[++i]];
    else throw new Error(`unknown arg: ${a}`);
  }
  return out;
}

function districtOf(type, item) {
  if (type === "NEED") return item.beneficiary?.district || item.district || "";
  if (type === "OFFER") return Array.isArray(item.districts) && item.districts[0] ? item.districts[0] : "";
  if (type === "PROJECT") return item.district || "";
  return "";
}

async function ensureIncidentRecord(ddb, tableName, apply) {
  const existing = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `INCIDENT#${INCIDENT_ID}`, SK: "META" } }));
  if (existing.Item) {
    console.log(`[incident] ${INCIDENT_ID} already exists (status=${existing.Item.status}) — leaving as-is`);
    return;
  }
  const now = new Date().toISOString();
  const item = {
    PK: `INCIDENT#${INCIDENT_ID}`,
    SK: "META",
    type: "INCIDENT",
    id: INCIDENT_ID,
    name: "Bhote Koshi flash flood",
    nameNe: "भोटेकोशी बाढी",
    kind: "flash-flood",
    status: "active",
    startedAt: "2026-08-26",
    affectedDistricts: ["Rasuwa", "Nuwakot", "Sindhupalchok"],
    sourceAttribution: { label: "NDRRMA", url: "https://ndrrma.gov.np" },
    requestOrigin: "admin",
    createdAt: now,
    approvedAt: now,
    gsi1pk: "INCIDENT#active",
    gsi1sk: now,
  };
  console.log(`[incident] ${apply ? "creating" : "would create"} ${INCIDENT_ID}:`, JSON.stringify(item, null, 2));
  if (apply) await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
}

async function backfillType(ddb, tableName, type, apply) {
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: "#t = :t",
      ExpressionAttributeNames: { "#t": "type" },
      ExpressionAttributeValues: { ":t": type },
      ExclusiveStartKey,
    }));
    for (const item of res.Items || []) {
      scanned++;
      if (item.incidentId) { skipped++; continue; }
      const district = districtOf(type, item);
      const status = item.status || "";
      const gsi1pk = `${type}#${INCIDENT_ID}#${district}#${status}`;
      if (updated < 5 || !apply) {
        console.log(`[${type}] ${apply ? "updating" : "would update"} ${item.PK} -> incidentId=${INCIDENT_ID}, gsi1pk=${gsi1pk}`);
      }
      if (apply) {
        await ddb.send(new UpdateCommand({
          TableName: tableName,
          Key: { PK: item.PK, SK: item.SK },
          UpdateExpression: "SET incidentId = :iid, gsi1pk = :pk",
          ConditionExpression: "attribute_not_exists(incidentId)",
          ExpressionAttributeValues: { ":iid": INCIDENT_ID, ":pk": gsi1pk },
        })).catch((e) => {
          if (e.name !== "ConditionalCheckFailedException") throw e;
        });
      }
      updated++;
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  console.log(`[${type}] scanned=${scanned} ${apply ? "updated" : "would update"}=${updated} already-tagged=${skipped}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.table) throw new Error("--table <TableName> is required (no default — this must never silently target the wrong table)");
  const client = new DynamoDBClient(args.region ? { region: args.region } : {});
  const ddb = DynamoDBDocumentClient.from(client);
  console.log(`table=${args.table} mode=${args.apply ? "APPLY" : "DRY-RUN"} types=${args.types.join(",")}`);
  await ensureIncidentRecord(ddb, args.table, args.apply);
  for (const type of args.types) await backfillType(ddb, args.table, type, args.apply);
  if (!args.apply) console.log("\nDry run only — nothing written. Re-run with --apply to write.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
