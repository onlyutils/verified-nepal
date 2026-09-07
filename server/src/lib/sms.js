const SPARROW_URL = "https://api.sparrowsms.com/v2/sms/";

let config = {
  token: "",
  from: "VerifiedNP",
  fetchImpl: globalThis.fetch,
  siteBase: "https://verifiednepal.com",
};

export function configureSms(env = {}, fetchImpl = globalThis.fetch) {
  const token = typeof env.SPARROW_TOKEN === "string" ? env.SPARROW_TOKEN.trim() : "";
  const from = typeof env.SPARROW_FROM === "string" && env.SPARROW_FROM.trim() ? env.SPARROW_FROM.trim() : "VerifiedNP";
  const siteBase = typeof env.PUBLIC_SITE_BASE === "string" && env.PUBLIC_SITE_BASE.trim()
    ? env.PUBLIC_SITE_BASE.trim().replace(/\/+$/, "")
    : "https://verifiednepal.com";
  config = { token, from, fetchImpl: fetchImpl || globalThis.fetch, siteBase };
  if (!token) console.info("Sparrow SMS not configured");
}

export function getSmsSiteBase() {
  return config.siteBase;
}

function normalizeNepalNumber(value) {
  if (value === undefined || value === null) return "";
  let number = String(value).trim().replace(/[\s-]/g, "");
  if (number.startsWith("+977")) number = number.slice(4);
  else if (number.startsWith("977") && number.length === 13) number = number.slice(3);
  return number;
}

export async function sendSms(options = {}) {
  const { to, text } = options || {};
  const number = normalizeNepalNumber(to);
  if (!number) return { sent: false, skipped: "no_phone" };
  if (!/^9\d{9}$/.test(number)) return { sent: false, skipped: "bad_number" };
  if (!config.token) return { sent: false, skipped: "not_configured" };

  try {
    const response = await config.fetchImpl(SPARROW_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: config.token, from: config.from, to: number, text }),
    });
    const status = typeof response?.status === "number" ? response.status : undefined;
    const ok = status === undefined ? response?.ok !== false : status >= 200 && status < 300;
    if (!ok) {
      console.error("Sparrow SMS failed", { status });
      return { sent: false, ...(status === undefined ? {} : { status }) };
    }
    return { sent: true, ...(status === undefined ? {} : { status }) };
  } catch (error) {
    console.error("Sparrow SMS failed", { error: error?.message });
    return { sent: false };
  }
}
