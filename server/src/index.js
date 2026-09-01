import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { route } from "./router.js";
import { json } from "./lib/http.js";

export { __clearMediaTokenCache } from "./models/media.js";

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
      return await route(event, { getDdb, env, fetchJwks, fetchImpl });
    } catch (e) {
      const status = e.status ?? e.statusCode ?? 500;
      const safe = status === 500 ? "Internal Server Error" : e.message || "Error";
      return json(status, { error: safe });
    }
  };
}

export const handler = createHandler();
