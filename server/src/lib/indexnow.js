// Notifies Bing/IndexNow-participating engines when a public page's content changes,
// so re-crawls happen faster than waiting on the sitemap's own crawl cadence.
// Key file lives at public/4c64f7a4fbf944e28f9c997a9b58ed53.txt in the frontend repo.
const HOST = "verifiednepal.com";
const KEY = "4c64f7a4fbf944e28f9c997a9b58ed53";

/** Fire-and-forget: a failure here must never affect the publish response. */
export async function pingIndexNow(paths, env = process.env) {
  if (env.INDEXNOW_DISABLED) return;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `https://${HOST}/${KEY}.txt`,
        urlList: paths.map((p) => `https://${HOST}${p}`),
      }),
    });
  } catch {
    // best-effort notification only
  }
}
