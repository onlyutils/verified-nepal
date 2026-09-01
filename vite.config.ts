import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { isPrivateApiPath, isPublicApiPath, hasAuthHeader } from "./src/lib/sw-rules";

void isPrivateApiPath;
void isPublicApiPath;
void hasAuthHeader;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["brand/logo-mark.svg", "pwa-192.png", "pwa-512.png", "pwa-maskable-512.png"],
      manifest: {
        name: "VerifiedNepal",
        short_name: "VerifiedNepal",
        theme_color: "#FFFFFF",
        background_color: "#FFFFFF",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/data\/.*/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "vn-data",
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/data/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "vn-data-local",
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: ({ url, request }: { url: URL; request: Request }) => {
              const method = (request as unknown as { method?: string })?.method ?? "GET";
              if (method !== "GET") return true;
              const headers: unknown = (request as unknown as { headers?: unknown })?.headers;
              if (headers) {
                try {
                  const h = headers as { has?: (k: string) => boolean; get?: (k: string) => unknown };
                  if (typeof h.has === "function" && (h.has("Authorization") || h.has("authorization"))) return true;
                  if (typeof h.get === "function" && (h.get("Authorization") || h.get("authorization"))) return true;
                } catch {}
                try {
                  const rec = headers as Record<string, unknown>;
                  if (rec["Authorization"] || rec["authorization"]) return true;
                } catch {}
              }
              const p = url.pathname;
              if (p === "/me" || p.startsWith("/me/")) return true;
              if (p === "/auth" || p.startsWith("/auth/")) return true;
              if (p.startsWith("/moderation/")) return true;
              if (p.startsWith("/admin/")) return true;
              if (p === "/claims" || p.startsWith("/claims/")) return true;
              return false;
            },
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url, request }: { url: URL; request: Request }) => {
              const method = (request as unknown as { method?: string })?.method ?? "GET";
              if (method !== "GET") return false;
              const headers: unknown = (request as unknown as { headers?: unknown })?.headers;
              if (headers) {
                try {
                  const h = headers as { has?: (k: string) => boolean; get?: (k: string) => unknown };
                  if (typeof h.has === "function" && (h.has("Authorization") || h.has("authorization"))) return false;
                  if (typeof h.get === "function" && (h.get("Authorization") || h.get("authorization"))) return false;
                } catch {}
                try {
                  const rec = headers as Record<string, unknown>;
                  if (rec["Authorization"] || rec["authorization"]) return false;
                } catch {}
              }
              const p = url.pathname;
              if (p === "/me" || p.startsWith("/me/")) return false;
              if (p === "/auth" || p.startsWith("/auth/")) return false;
              if (p.startsWith("/moderation/")) return false;
              if (p.startsWith("/admin/")) return false;
              if (p === "/claims" || p.startsWith("/claims/")) return false;
              if (p === "/needs" || p === "/offers" || p === "/ledger" || p === "/audit") return true;
              if (p === "/projects" || p.startsWith("/projects/")) return true;
              if (p === "/dispatches" || p.startsWith("/dispatches/")) return true;
              if (p.startsWith("/status/")) return true;
              return false;
            },
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "vn-api",
              expiration: { maxEntries: 100, maxAgeSeconds: 300 },
            },
            method: "GET",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 8765,
    strictPort: true,
  },
  preview: {
    port: 8765,
    strictPort: true,
  },
});
