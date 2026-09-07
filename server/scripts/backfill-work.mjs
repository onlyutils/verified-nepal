#!/usr/bin/env node
// Rebuilds monthly WORK items from the audit log and on-behalf NEED records.
// Usage: node server/scripts/backfill-work.mjs --table <TableName> [--from=YYYY-MM] [--region <region>] [--dry-run|--apply]
// Dry-run is the default; pass --apply to write the rebuilt items.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { MOD_STATUS, PUBLIC_NEED_STATUSES } from "../src/constants.js";
import { workKey } from "../src/models/work.js";

const DEFAULT_FROM = "2026-08";
const NEED_STATUSES = [...new Set([
  "pending",
  ...PUBLIC_NEED_STATUSES,
  ...MOD_STATUS,
  "rejected",
])];

function parseArgs(argv) {
  const out = { dryRun: true, from: DEFAULT_FROM };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--apply") out.dryRun = false;
    else if (arg === "--table") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error("--table <TableName> is required");
      out.table = value;
    }
    else if (arg === "--region") out.region = argv[++i];
    else if (arg === "--from") out.from = argv[++i];
    else if (arg.startsWith("--from=")) out.from = arg.slice("--from=".length);
    else throw new Error(`unknown arg: ${arg}`);
  }
  if (!out.table) throw new Error("--table <TableName> is required");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(out.from)) throw new Error("--from must be YYYY-MM");
  return out;
}

function monthRange(from, through) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [throughYear, throughMonth] = through.split("-").map(Number);
  const months = [];
  let year = fromYear;
  let month = fromMonth;
  while (year < throughYear || (year === throughYear && month <= throughMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month++;
    if (month === 13) {
      year++;
      month = 1;
    }
  }
  return months;
}

function addCount(work, sub, month, action) {
  const key = `${sub}|${month}`;
  let row = work.get(key);
  if (!row) {
    row = { sub, month, counts: {}, total: 0 };
    work.set(key, row);
  }
  const counter = `c_${workKey(action)}`;
  row.counts[counter] = (row.counts[counter] || 0) + 1;
  row.total++;
}

async function queryPartition(ddb, tableName, pk, extra = {}) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new QueryCommand({
      TableName: tableName,
      ...extra,
      KeyConditionExpression: extra.KeyConditionExpression || "PK = :pk",
      ExpressionAttributeValues: extra.ExpressionAttributeValues || { ":pk": pk },
      ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
    }));
    if (res.Items) items.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const months = monthRange(args.from, currentMonth);
  if (!months.length) throw new Error("--from cannot be after the current month");
  const monthSet = new Set(months);
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient(args.region ? { region: args.region } : {}));
  const work = new Map();

  for (const month of months) {
    const items = await queryPartition(ddb, args.table, `AUDIT#${month}`);
    for (const item of items) {
      if (item.type !== "AUDIT" || !item.actorSub) continue;
      const actionMonth = String(item.ts || item.createdAt || "").slice(0, 7);
      if (!monthSet.has(actionMonth)) continue;
      addCount(work, item.actorSub, actionMonth, item.action);
    }
  }

  for (const status of NEED_STATUSES) {
    const items = await queryPartition(ddb, args.table, `NEED#${status}`, {
      IndexName: "GSI2",
      KeyConditionExpression: "gsi2pk = :pk",
      ExpressionAttributeValues: { ":pk": `NEED#${status}` },
    });
    for (const item of items) {
      if (item.type !== "NEED" || !item.registrantSub || !item.createdAt) continue;
      const month = String(item.createdAt).slice(0, 7);
      if (!monthSet.has(month)) continue;
      addCount(work, item.registrantSub, month, "need.register");
    }
  }

  const rows = [...work.values()].sort((a, b) => a.month.localeCompare(b.month) || a.sub.localeCompare(b.sub));
  console.log(`table=${args.table} mode=${args.dryRun ? "DRY-RUN" : "APPLY"} from=${args.from} through=${currentMonth}`);
  console.log("sub\tmonth\ttotal");
  const updatedAt = new Date().toISOString();
  for (const row of rows) {
    console.log(`${row.sub}\t${row.month}\t${row.total}`);
    if (!args.dryRun) {
      await ddb.send(new PutCommand({
        TableName: args.table,
        Item: {
          PK: `USER#${row.sub}`,
          SK: `WORK#${row.month}`,
          type: "WORK",
          sub: row.sub,
          month: row.month,
          ...row.counts,
          total: row.total,
          updatedAt,
        },
      }));
    }
  }
  console.log(`${args.dryRun ? "would write" : "wrote"} ${rows.length} WORK items`);
  if (args.dryRun) console.log("Dry run only — nothing written. Re-run with --apply to write.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
