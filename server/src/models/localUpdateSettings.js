import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { NEWS_DAILY_LIMIT } from "../constants.js";

const key = { PK: "SETTINGS", SK: "LOCAL_UPDATES" };

export async function getLocalUpdateSettings(ddb, tableName) {
  const { Item } = await ddb.send(new GetCommand({ TableName: tableName, Key: key }));
  return {
    dailyLimitEnabled: Item?.dailyLimitEnabled ?? true,
    dailyLimit: Item?.dailyLimit ?? NEWS_DAILY_LIMIT,
  };
}

export async function putLocalUpdateSettings(ddb, tableName, settings) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: { ...key, ...settings } }));
  return settings;
}
