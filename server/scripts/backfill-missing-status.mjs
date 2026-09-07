#!/usr/bin/env node
// Backfills legacy MISSING records that predate publication moderation.
// Usage: node server/scripts/backfill-missing-status.mjs --table <TableName> [--region <region>] [--apply]
// Dry-run is the default and only reports how many MISSING items lack publicationStatus.
// Credentials come from the AWS SDK's normal environment/profile configuration.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

function parseArgs(argv) {
  const out = { apply: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") out.apply = true;
    else if (arg === "--table") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error("--table <TableName> is required");
      out.table = value;
    }
    else if (arg === "--region") out.region = argv[++i];
    else throw new Error(`unknown arg: ${arg}`);
  }
  if (!out.table) throw new Error("--table <TableName> is required");
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient(args.region ? { region: args.region } : {}));
  let missingStatus = 0;
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: args.table,
      FilterExpression: "#type = :type AND attribute_not_exists(publicationStatus)",
      ExpressionAttributeNames: { "#type": "type" },
      ExpressionAttributeValues: { ":type": "MISSING" },
      ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
    }));
    for (const item of res.Items || []) {
      if (item.type !== "MISSING" || item.publicationStatus !== undefined) continue;
      missingStatus++;
      if (args.apply) {
        await ddb.send(new UpdateCommand({
          TableName: args.table,
          Key: { PK: item.PK, SK: item.SK },
          UpdateExpression: "SET publicationStatus = :status, gsi2pk = :pk, gsi2sk = :sk",
          ConditionExpression: "attribute_not_exists(publicationStatus)",
          ExpressionAttributeValues: {
            ":status": "published",
            ":pk": "MISSING#published",
            ":sk": item.createdAt || new Date().toISOString(),
          },
        })).catch((error) => {
          if (error.name !== "ConditionalCheckFailedException") throw error;
        });
      }
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  console.log(`${args.apply ? "updated" : "would update"} ${missingStatus} MISSING items lacking publicationStatus`);
  if (!args.apply) console.log("Dry run only — nothing written. Re-run with --apply to write.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
