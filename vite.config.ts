import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
// runtime caching for import.meta.env.VITE_API_BASE GET requests -> StaleWhileRevalidate

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
            urlPattern: new RegExp((process.env.VITE_API_BASE || "https://api.verifiednepal.com").replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&") + ".*"),
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
