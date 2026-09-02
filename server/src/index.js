import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { route } from "./router.js";
import { json } from "./lib/http.js";

export { __clearMediaTokenCache } from "./models/media.js";

// Ensure every response — including hand-built ones (audit, ledger CSV) and error
// responses — carries baseline security headers, without overriding a header a
// handler set deliberately.
function withSecurityHeaders(res) {
  if (!res || typeof res !== "object") return res;
  const headers = { ...(res.headers || {}) };
  const has = (n) => Object.keys(headers).some((k) => k.toLowerCase() === n);
  if (!has("x-content-type-options")) headers["x-content-type-options"] = "nosniff";
  if (!has("referrer-policy")) headers["referrer-policy"] = "no-referrer";
  return { ...res, headers };
}

export function createHandler(opts = {}) {
  const env = opts.env ?? process.env;
  const fetchJwks = opts.fetchJwks;
  const fetchImpl = opts.fetch ?? opts.fetchImpl ?? globalThis.fetch;
  let ddbClient = opts.ddbClient ?? null;
  function getDdb() {
    if (ddbClient) return ddbClient;
    const client = new DynamoDBClient({});
    ddbClient = DynamoDBDocumentClient.from(client);
    return ddbClient;
  }
  return async (event) => {
    try {
      return withSecurityHeaders(await route(event, { getDdb, env, fetchJwks, fetchImpl }));
    } catch (e) {
      const status = e.status ?? e.statusCode ?? 500;
      const safe = status === 500 ? "Internal Server Error" : e.message || "Error";
      return withSecurityHeaders(json(status, { error: safe }));
    }
  };
}

export const handler = createHandler();
