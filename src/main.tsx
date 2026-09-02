import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { App } from "@/App";
import { brandChatWidget, wireRegionContext } from "@/lib/chat-widget";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

brandChatWidget();
wireRegionContext();

// After a deploy the new service worker takes over (skipWaiting) and purges old
// hashed assets; tabs still running old HTML would then load HTML as CSS/JS.
// Reload once when a *new* SW replaces the one already controlling this page.
if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
}
