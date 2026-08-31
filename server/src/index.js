import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { verifyIdToken } from "./verify.js";

function json(status, body) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function getAuthToken(headers) {
  if (!headers) return null;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "authorization") return v;
  }
  return null;
}

async function handleMe(event, { fetchJwks, getDdb, env }) {
  const auth = getAuthToken(event.headers);
  if (!auth || !auth.startsWith("Bearer ")) {
    const e = new Error("Missing or invalid Authorization header");
    e.status = 401;
    throw e;
  }
  const token = auth.slice("Bearer ".length).trim();
  if (!token) {
    const e = new Error("Missing token");
    e.status = 401;
    throw e;
  }

  let payload;
  try {
    payload = await verifyIdToken(token, {
      fetchJwks,
      googleClientId: env.GOOGLE_CLIENT_ID,
    });
  } catch (e) {
    if (e.status === 500) throw e;
    const err = new Error(e.message || "Invalid token");
    err.status = 401;
    throw err;
  }

  const tableName = env.TABLE_NAME;
  if (!tableName) {
    const e = new Error("TABLE_NAME not configured");
    e.status = 500;
    throw e;
  }

  const ddb = getDdb();
  const pk = `USER#${payload.sub}`;
  const sk = "PROFILE";

  let existing;
  try {
    const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: pk, SK: sk } }));
    existing = res.Item;
  } catch (e) {
    const err = new Error("Failed to read user");
    err.status = 500;
    throw err;
  }

  let role;
  let email = payload.email ?? "";
  let name = payload.name ?? "";

  if (existing) {
    role = existing.role;
    if (existing.email) email = existing.email;
    if (existing.name) name = existing.name;
  } else {
    const adminEmails = (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = payload.email_verified === true && email && adminEmails.includes(String(email).toLowerCase());
    role = isAdmin ? "admin" : "helper";
    const item = {
      PK: pk,
      SK: sk,
      sub: payload.sub,
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
    };
    try {
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(PK)",
        })
      );
    } catch (e) {
      if (e.name === "ConditionalCheckFailedException") {
        try {
          const res2 = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: pk, SK: sk } }));
          if (res2.Item) {
            role = res2.Item.role;
            if (res2.Item.email) email = res2.Item.email;
            if (res2.Item.name) name = res2.Item.name;
          } else {
            const err = new Error("Failed to create user");
            err.status = 500;
            throw err;
          }
        } catch (e2) {
          if (e2.status) throw e2;
          const err = new Error("Failed to read user after conflict");
          err.status = 500;
          throw err;
        }
      } else if (e.status && e.status !== 500) {
        throw e;
      } else {
        const err = new Error("Failed to create user");
        err.status = 500;
        throw err;
      }
    }
  }

  return json(200, { sub: payload.sub, email, name, role });
}

export function createHandler(opts = {}) {
  const env = opts.env ?? process.env;
  const fetchJwks = opts.fetchJwks;
  let ddbClient = opts.ddbClient ?? null;

  function getDdb() {
    if (ddbClient) return ddbClient;
    const client = new DynamoDBClient({});
    ddbClient = DynamoDBDocumentClient.from(client);
    return ddbClient;
  }

  return async (event) => {
    try {
      const method =
        event.requestContext?.http?.method ??
        event.requestContext?.httpMethod ??
        event.httpMethod ??
        "GET";
      const rawPath =
        event.rawPath ??
        event.requestContext?.http?.path ??
        event.path ??
        "/";

      const path = rawPath.split("?")[0];
      const key = `${String(method).toUpperCase()} ${path}`;

      if (key === "GET /health") {
        return json(200, { ok: true });
      }
      if (key === "GET /me") {
        return await handleMe(event, { fetchJwks, getDdb, env });
      }
      return json(404, { error: "Not Found" });
    } catch (err) {
      const status = err.status ?? err.statusCode ?? 500;
      const safe = status === 500 ? "Internal Server Error" : err.message || "Error";
      return json(status, { error: safe });
    }
  };
}

export const handler = createHandler();
