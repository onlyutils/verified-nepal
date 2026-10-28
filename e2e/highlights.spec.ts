import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const NEWS_API = process.env.E2E_NEWS_API_BASE;
const NEWS_SITE = process.env.E2E_NEWS_SITE_BASE;
const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const createdIds: string[] = [];
const idsByTitle = new Map<string, string>();
const machineToken = process.env.E2E_MACHINE_TOKEN;
let seededTitles: string[] = [];

type NewsRecord = { id: string; title: string; published?: boolean };

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required. Run with: eval "$(e2e/load-env.sh)" && pnpm e2e`);
  return value;
}

async function machineRequest<T>(route: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${required(NEWS_API, "E2E_NEWS_API_BASE")}${route}`, {
    ...init,
    headers: { authorization: `Bearer ${machineToken}`, "content-type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(`News API ${init.method ?? "GET"} ${route} returned ${response.status}`);
  return (await response.json()) as T;
}

async function seedPost(index: number, title: string, language: "en" | "ne", municipalityId: number, district: string) {
  const body = {
    author: { sub: "e2e", name: "E2E Bot" },
    language,
    title,
    blocks: [{ type: "paragraph", text: `E2E fixture ${index}` }],
    scope: "municipality",
    locality: { district, municipalityId, ward: (index % 5) + 1 },
    happenedAt: new Date(Date.now() - index * 60_000).toISOString(),
    sourceUrls: ["https://example.com/report"],
  };
  const post = await machineRequest<NewsRecord>("/internal/news", { method: "POST", body: JSON.stringify(body) });
  createdIds.push(post.id);
  idsByTitle.set(title, post.id);
  await machineRequest(`/internal/news/${encodeURIComponent(post.id)}/publish`, { method: "POST" });
  return post;
}

async function seedFixtures() {
  required(machineToken, "E2E_MACHINE_TOKEN");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  seededTitles = Array.from({ length: 2 }, (_, i) => `E2E-${suffix}-${i + 1}`);
  for (let i = seededTitles.length - 1; i >= 0; i -= 1) {
    await seedPost(i, seededTitles[i], i === 1 ? "ne" : "en", i % 2 === 0 ? 29001 : 26001, i % 2 === 0 ? "Rasuwa" : "Bhaktapur");
  }
}

async function cleanFixtures() {
  if (!machineToken) return;
  await Promise.all(createdIds.map((id) => machineRequest(`/internal/news/${encodeURIComponent(id)}`, { method: "DELETE" })));
}

test.beforeAll(async () => {
  await seedFixtures();
});

test.afterAll(async () => {
  await cleanFixtures();
});

test.beforeEach(async ({ page, baseURL }) => {
  const allowedOrigin = new URL(required(baseURL, "baseURL")).origin;
  await page.route(
    (url) =>
      (url.hostname === "api.news-dev.verifiednepal.com" && url.pathname === "/news") ||
      (url.hostname === "api.dev.verifiednepal.com" && url.pathname.startsWith("/dispatches")),
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), "access-control-allow-origin": allowedOrigin },
      });
    },
  );
});

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Local updates|स्थानीय अपडेट/ })).toBeVisible();
}

async function setEnglish(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("verifiednepal:language", "en"));
  await page.reload();
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(fullPath) : /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
    }),
  );
  return nested.flat();
}

async function interceptFreshNewsFeed(page: Page, expectedTitles: string[] = []) {
  const origin = new URL(required(process.env.E2E_BASE_URL || "http://localhost:8765", "baseURL")).origin;
  const fetchFeed = async () => {
    const feedUrl = new URL(`${required(NEWS_API, "E2E_NEWS_API_BASE")}/news`);
    feedUrl.searchParams.set("limit", "6");
    feedUrl.searchParams.set("e2e", `${Date.now()}-${Math.random()}`);
    const response = await fetch(feedUrl, { cache: "no-store" });
    const body = await response.text();
    expect(response.ok).toBeTruthy();
    const items = (JSON.parse(body) as { items?: Array<{ title?: string }> }).items ?? [];
    return { response, body, items };
  };
  if (expectedTitles.length) {
    await expect
      .poll(
        async () => {
          const { items } = await fetchFeed();
          return items.map((item) => item.title).filter((title) => expectedTitles.includes(title as string));
        },
        { timeout: 20_000 },
      )
      .toEqual(expectedTitles);
  }
  const { response, body } = await fetchFeed();
  await page.route(
    (url) => url.origin === NEWS_API && url.pathname === "/news",
    (route) =>
      route.fulfill({
        status: response.status,
        body,
        headers: {
          "content-type": response.headers.get("content-type") ?? "application/json",
          "access-control-allow-origin": origin,
        },
      }),
  );
}

test("published highlights render latest rows, locality and language in both site languages", async ({ page }) => {
  // Protects the promise that published local updates appear as useful, bilingual links on the homepage.
  await setEnglish(page);
  await interceptFreshNewsFeed(page, seededTitles.slice(0, 6));
  await openHome(page);
  const section = page.getByRole("region", { name: "Local updates" });
  await expect(section.getByRole("link", { name: seededTitles[0] })).toHaveAttribute(
    "href",
    `${NEWS_SITE}/n/${idsByTitle.get(seededTitles[0])}`,
  );
  await expect(section.getByRole("link", { name: seededTitles[0] })).toHaveAttribute("target", "_blank");
  await expect(section.getByRole("link", { name: seededTitles[0] })).toHaveAttribute("rel", "noopener");
  const titles = await section.locator("h3 a").allTextContents();
  expect(titles.length).toBeLessThanOrEqual(6);
  expect(titles.indexOf(seededTitles[0])).toBeGreaterThanOrEqual(0);
  expect(titles.indexOf(seededTitles[0])).toBeLessThan(titles.indexOf(seededTitles[1]));
  await expect(section.getByText("Gosaikunda · Ward 1")).toBeVisible();
  expect(await section.getByText("EN", { exact: true }).count()).toBeGreaterThan(0);
  expect(await section.getByText("ने", { exact: true }).count()).toBeGreaterThan(0);
  await expect(section.locator("time").first()).toBeVisible();
  await expect(section.getByRole("link", { name: /See all local updates/ })).toHaveAttribute("href", NEWS_SITE);

  await page.getByRole("button", { name: /नेपाली/ }).click();
  await expect(page.getByRole("heading", { name: "स्थानीय अपडेट" })).toBeVisible();
  await expect(page.getByRole("link", { name: /सबै स्थानीय अपडेट हेर्नुहोस्/ })).toBeVisible();
});

for (const [caseName, response] of [
  [
    "empty",
    async (route: Parameters<Parameters<Page["route"]>[1]>[0]) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }),
  ],
  [
    "500",
    async (route: Parameters<Parameters<Page["route"]>[1]>[0]) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) }),
  ],
  ["aborted", async (route: Parameters<Parameters<Page["route"]>[1]>[0]) => route.abort("failed")],
  [
    "malformed JSON",
    async (route: Parameters<Parameters<Page["route"]>[1]>[0]) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{" }),
  ],
] as const) {
  test(`home stays usable when highlights feed is ${caseName}`, async ({ page }) => {
    // Protects the promise that an unavailable or invalid local-updates feed cannot break the main homepage.
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route((url) => url.origin === NEWS_API && url.pathname === "/news", response);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Local updates|स्थानीय अपडेट/ })).toHaveCount(0);
    await expect(page.getByRole("region", { name: /Local updates|स्थानीय अपडेट/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Now|अहिले/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Find someone|व्यक्ति खोज्नुहोस्/ })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}

test("unpublished news is removed from highlights after reload", async ({ page }) => {
  // Protects the promise that a newly unpublished item disappears from the public highlights feed.
  await setEnglish(page);
  await interceptFreshNewsFeed(page, seededTitles);
  await page.reload();
  await expect(page.getByRole("link", { name: seededTitles[0], exact: true })).toBeVisible();
  const target = idsByTitle.get(seededTitles[0])!;
  await machineRequest(`/internal/news/${encodeURIComponent(target)}/unpublish`, { method: "POST" });
  const freshTitles = async () => {
    const response = await fetch(`${required(NEWS_API, "E2E_NEWS_API_BASE")}/news?limit=6&e2e=${Date.now()}-${Math.random()}`, {
      cache: "no-store",
    });
    expect(response.ok).toBeTruthy();
    return ((await response.json()) as { items?: Array<{ title?: string }> }).items?.map((item) => item.title) ?? [];
  };
  await expect.poll(async () => (await freshTitles()).includes(seededTitles[0]), { timeout: 20_000 }).toBe(false);
  await interceptFreshNewsFeed(page, seededTitles.slice(1));
  await page.reload();
  await expect(page.getByRole("link", { name: seededTitles[0], exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: seededTitles[1], exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Local updates/ })).toBeVisible();
  // The test rewrites the feed URL with a unique query value because the API's public response is cached for five minutes.
});

test("old local routes redirect at the edge and the app no longer links to them", async ({ page }) => {
  // Protects the promise that old public paths are redirected and no app navigation sends readers back to them.
  const redirects = await readFile(path.resolve(THIS_DIR, "../public/_redirects"), "utf8");
  for (const line of [
    "/local-updates https://news.verifiednepal.com 301",
    "/local-updates/* https://news.verifiednepal.com 301",
    "/local https://news.verifiednepal.com/local 301",
    "/local/* https://news.verifiednepal.com/local/:splat 301",
  ])
    expect(redirects.split(/\r?\n/)).toContain(line);
  const source = await Promise.all((await sourceFiles(path.resolve(THIS_DIR, "../src"))).map((file) => readFile(file, "utf8")));
  expect(source.join("\n")).not.toMatch(/href\s*=\s*["']\/local-updates(?:["'/])/);
  await page.goto("/");
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: "Local updates", exact: true })).toHaveCount(0);
  await expect(nav.getByText("Local updates", { exact: true })).toHaveCount(0);
});

test("articles, Now strip and Desk login remain available", async ({ page, request }) => {
  // Protects existing article reading, Now updates and Desk sign-in routes while the homepage changes.
  await setEnglish(page);
  await page.goto("/articles");
  const listing = await request.get(`${process.env.VITE_API_BASE ?? "https://api.dev.verifiednepal.com"}/dispatches`);
  expect(listing.ok()).toBeTruthy();
  const { items } = (await listing.json()) as { items: Array<{ id: string }> };
  await expect(page.getByRole("heading", { name: /Articles|लेख/ })).toBeVisible();
  if (items.length) {
    const detailResponse = await request.get(
      `${process.env.VITE_API_BASE ?? "https://api.dev.verifiednepal.com"}/dispatches/${encodeURIComponent(items[0].id)}`,
    );
    expect(detailResponse.ok()).toBeTruthy();
    await page.goto(`/articles/${encodeURIComponent(items[0].id)}`);
    await expect(page.getByRole("article")).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to articles|लेखहरूमा फर्कनुहोस्/ })).toBeVisible();
  }
  const allowedOrigin = new URL(required(process.env.E2E_BASE_URL || "http://localhost:8765", "baseURL")).origin;
  await page.route(
    (url) => url.hostname === "api.dev.verifiednepal.com",
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), "access-control-allow-origin": allowedOrigin } });
    },
  );
  const ledgerResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/ledger");
  const storiesResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/stories");
  const reachResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/reach");
  await page.goto("/");
  expect((await ledgerResponse).ok()).toBeTruthy();
  await Promise.all([storiesResponse, reachResponse]);
  await expect(page.getByRole("region", { name: /Now|अहिले/ })).toBeVisible();
  const nowRows = page.getByRole("region", { name: /Now|अहिले/ }).locator("li");
  const ledger = await request.get(`${process.env.VITE_API_BASE ?? "https://api.dev.verifiednepal.com"}/ledger`);
  const ledgerItems = ledger.ok() ? (((await ledger.json()) as { items?: unknown[] }).items ?? []) : [];
  expect((await nowRows.count()) > 0 || ledgerItems.length > 0).toBeTruthy();
  await page.goto("/desk/login");
  await expect(page.getByRole("heading", { name: /sign in|प्रवेश/i })).toBeVisible();
  const homeConsoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") homeConsoleErrors.push(message.text());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Now|अहिले/ })).toBeVisible();
  expect(homeConsoleErrors).toEqual([]);
});

test("360px home with highlights has no horizontal overflow and highlight links are touch sized", async ({ page }) => {
  // Protects the promise that local updates remain usable on a narrow touch screen.
  await page.setViewportSize({ width: 360, height: 740 });
  await openHome(page);
  const dimensions = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  const links = page.getByRole("region", { name: "Local updates" }).locator("a");
  for (const link of await links.all()) {
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});
