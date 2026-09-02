import { err } from "./http.js";

export async function verifyTurnstile(token, secret, { required = false } = {}) {
  if (!secret) {
    // Fail closed where the platform expects a secret (deployed envs set REQUIRE_TURNSTILE),
    // so a misdeploy that drops the secret rejects anonymous writes instead of silently allowing them.
    if (required) throw err(500, "turnstile misconfigured");
    return;
  }
  if (!token || typeof token !== "string" || !token.trim()) throw err(400, "turnstile token required");
  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", token);
  let res;
  try {
    res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: params,
    });
  } catch (_e) {
    throw err(400, "turnstile verification failed");
  }
  let data;
  try {
    data = await res.json();
  } catch (_e) {
    throw err(400, "turnstile verification failed");
  }
  if (!data.success) throw err(400, "turnstile verification failed");
}
