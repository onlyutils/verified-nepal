/**
 * The OnlyUtils chat widget ships no theming hooks, but it renders into an open
 * shadow root and reads `--ouc-*` custom properties. So: set the variables on
 * the host, inject one stylesheet for the parts variables cannot reach, and stamp the
 * verifiedNepal mark plus the OnlyUtils credit into its DOM.
 */
const HOST_ID = "onyutils-chat-widget";
const ONLYUTILS_URL = "https://onlyutils.com";

const hostVars = {
  "--ouc-primary": "#003893",
  "--ouc-primary-fg": "#FFFFFF",
  "--ouc-bg": "#FFFFFF",
  "--ouc-text": "#1C1B1A",
  "--ouc-muted": "#5A5754",
  "--ouc-border": "#E5E0D8",
  "--ouc-assistant-bg": "#F7F5F0",
  "--ouc-radius": "12px",
  "--ouc-radius-sm": "8px",
  "--ouc-launcher-size": "56px",
  "--ouc-shadow": "0 12px 32px -12px rgba(28, 27, 26, 0.35)",
  "--ouc-font": '"Noto Sans", "Noto Sans Devanagari", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

/* Theme: the same tokens as src/styles.css (blue primary, warm neutrals, 12px radius, one typeface). */
const shadowCss = `
.ouc-launcher {
  background: #003893;
  border: 0;
  border-radius: 9999px;
  box-shadow: 0 8px 24px -8px rgba(0, 56, 147, 0.5);
  overflow: hidden;
  padding: 0;
}
.ouc-launcher img { width: 32px; height: 32px; }

.ouc-panel {
  border: 1px solid #E5E0D8;
  border-radius: 12px;
  background: #FFFFFF;
}

.ouc-header {
  background: #003893;
  color: #FFFFFF;
  border-bottom: 0;
  gap: 10px;
}
.ouc-title { font-weight: 700; letter-spacing: 0; color: #FFFFFF; }
.vn-chat-brand { display: flex; align-items: center; gap: 9px; flex: 1; min-width: 0; }
.vn-chat-brand img { width: 24px; height: 24px; flex: none; border-radius: 9999px; background: #FFFFFF; }

.ouc-msg { border: 1px solid transparent; border-radius: 12px; }
.ouc-msg-assistant { background: #F7F5F0; border-color: #E5E0D8; color: #1C1B1A; }
.ouc-msg-user { background: #003893; color: #FFFFFF; }
.ouc-msg strong { font-weight: 600; }
.ouc-tel { font-weight: 700; text-decoration: underline; text-underline-offset: 2px; color: #B82020; }

.ouc-chip {
  background: #FFFFFF;
  border: 1px solid #E5E0D8;
  border-radius: 8px;
  color: #1C1B1A;
  font-size: 12px;
  font-weight: 600;
}
.ouc-chip:hover { background: #EDF1F8; border-color: #D4DCF0; color: #003893; }

.ouc-composer { border-top: 1px solid #E5E0D8; background: #FFFFFF; }
.ouc-input { background: #FFFFFF; border: 1px solid #E5E0D8; border-radius: 8px; color: #1C1B1A; }
.ouc-input:focus-visible { outline: none; border-color: #003893; box-shadow: 0 0 0 2px rgba(0, 56, 147, 0.25); }
.ouc-mic { background: #FFFFFF; border-radius: 8px; color: #5A5754; }
.ouc-send { background: #003893; border-radius: 8px; color: #FFFFFF; }
.ouc-send:hover:not(:disabled) { background: #002a70; }

.vn-chat-credit {
  flex: none;
  padding: 7px 12px 10px;
  text-align: center;
  font-size: 11px;
  line-height: 1.4;
  color: #938F8A;
  border-top: 1px solid #E5E0D8;
}
.vn-chat-credit a { color: #1C1B1A; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }

.vn-chat-disclaimer {
  flex: none;
  padding: 6px 12px;
  text-align: center;
  font-size: 11px;
  line-height: 1.4;
  color: #938F8A;
  border-top: 1px solid #E5E0D8;
  background: #F7F5F0;
}

/* Lift the launcher above the back-to-top button and page controls on phones. */
@media (max-width: 639px) {
  .ouc-launcher { bottom: 88px !important; }
}
`;

function decorate(root: ShadowRoot) {
  if (root.querySelector(".vn-chat-credit")) return; // already decorated
  const style = document.createElement("style");
  style.textContent = shadowCss;
  root.appendChild(style);

  const launcher = root.querySelector(".ouc-launcher");
  if (launcher) {
    launcher.innerHTML = '<img src="/brand/logo-mark-light.svg" alt="">';
  }

  const title = root.querySelector(".ouc-title");
  if (title && !title.querySelector("img")) {
    const wrap = document.createElement("span");
    wrap.className = "vn-chat-brand";
    wrap.innerHTML = '<img src="/brand/logo-mark.svg" alt="">';
    title.replaceWith(wrap);
    wrap.appendChild(title);
  }

  const composer = root.querySelector(".ouc-composer");
  if (composer) {
    const disclaimer = document.createElement("div");
    disclaimer.className = "vn-chat-disclaimer";
    disclaimer.textContent = "Do not include sensitive personal information in chat messages.";
    composer.insertAdjacentElement("beforebegin", disclaimer);
  }

  const panel = root.querySelector(".ouc-panel");
  if (panel) {
    const credit = document.createElement("div");
    credit.className = "vn-chat-credit";
    credit.innerHTML = `Powered by <a href="${ONLYUTILS_URL}" target="_blank" rel="noreferrer noopener">OnlyUtils</a>`;
    panel.appendChild(credit);
  }
}

export function brandChatWidget() {
  let tries = 0;
  const timer = window.setInterval(() => {
    const host = document.getElementById(HOST_ID);
    if (host?.shadowRoot?.querySelector(".ouc-panel")) {
      window.clearInterval(timer);
      Object.entries(hostVars).forEach(([key, value]) => host.style.setProperty(key, value));
      decorate(host.shadowRoot);
    } else if (++tries > 40) {
      window.clearInterval(timer);
    }
  }, 250);
}

let chatWidgetPromise: Promise<void> | null = null;
let chatWidgetLoaded = false;

export function ensureChatWidget(): Promise<void> {
  if (chatWidgetLoaded) return Promise.resolve();
  if (chatWidgetPromise) return chatWidgetPromise;
  const src = (import.meta.env.VITE_CHAT_WIDGET_SRC as string | undefined)?.trim();
  if (!src || src === "%VITE_CHAT_WIDGET_SRC%") return Promise.resolve();

  const dataKey = (import.meta.env.VITE_CHAT_KEY as string | undefined) || "";
  const dataApi = (import.meta.env.VITE_CHAT_API as string | undefined) || "";

  chatWidgetPromise = new Promise<void>((resolve) => {
    const startPolling = () => {
      let tries = 0;
      const timer = window.setInterval(() => {
        const host = document.getElementById(HOST_ID);
        const ready = Boolean(
          host?.shadowRoot?.querySelector(".ouc-panel") || (window as unknown as { OnyutilsChat?: unknown }).OnyutilsChat,
        );
        if (ready) {
          window.clearInterval(timer);
          chatWidgetLoaded = true;
          brandChatWidget();
          try {
            const saved = localStorage.getItem("vn:region");
            const api = (window as unknown as { OnyutilsChat?: { setContext?: (t: string) => void } }).OnyutilsChat;
            if (api?.setContext && saved) api.setContext(`Visitor's selected district: ${saved}`);
          } catch {}
          resolve();
        } else if (++tries > 40) {
          window.clearInterval(timer);
          chatWidgetLoaded = true;
          resolve();
        }
      }, 250);
    };

    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if ((existing as unknown as { _vnLoaded?: boolean })._vnLoaded) {
        startPolling();
      } else {
        existing.addEventListener(
          "load",
          () => {
            (existing as unknown as { _vnLoaded?: boolean })._vnLoaded = true;
            startPolling();
          },
          { once: true },
        );
        existing.addEventListener("error", () => resolve(), { once: true });
        startPolling();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    if (dataKey) script.setAttribute("data-key", dataKey);
    if (dataApi) script.setAttribute("data-api", dataApi);
    script.setAttribute("data-greeting", "I'm here to help. Ask about rescued or missing people, relief locations, or how to get help.");
    script.defer = true;
    script.addEventListener(
      "load",
      () => {
        (script as unknown as { _vnLoaded?: boolean })._vnLoaded = true;
        startPolling();
      },
      { once: true },
    );
    script.addEventListener("error", () => resolve(), { once: true });
    document.body.appendChild(script);
    startPolling();
  });

  return chatWidgetPromise;
}

export async function openChatWidget() {
  await ensureChatWidget();
  const root = document.getElementById(HOST_ID)?.shadowRoot;
  const panel = root?.querySelector(".ouc-panel");
  if (panel && !panel.classList.contains("ouc-open")) {
    root?.querySelector<HTMLButtonElement>(".ouc-launcher")?.click();
  }
  if (!panel) {
    const host = document.getElementById(HOST_ID)?.shadowRoot?.querySelector<HTMLButtonElement>(".ouc-launcher");
    host?.click();
  }
}

export function wireRegionContext() {
  const send = (region: string) => {
    const api = (window as unknown as { OnyutilsChat?: { setContext?: (t: string) => void } }).OnyutilsChat;
    if (!api?.setContext) return;
    api.setContext(region ? `Visitor's selected district: ${region}` : "");
  };
  try {
    const saved = localStorage.getItem("vn:region");
    if (saved) send(saved);
  } catch {}
  window.addEventListener("vn:region-change", (event) => {
    send(String((event as CustomEvent<{ region?: string }>).detail?.region ?? ""));
  });
}

function shouldPreload(): boolean {
  const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData) return false;
  const eff = conn?.effectiveType;
  if (eff === "slow-2g" || eff === "2g") return false;
  return true;
}

function scheduleIdlePreload() {
  if (!shouldPreload()) return;
  const run = () => {
    void ensureChatWidget();
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === "function") ric(run, { timeout: 4000 });
  else window.setTimeout(run, 4000);
}

if (typeof window !== "undefined") {
  if (document.readyState === "complete") scheduleIdlePreload();
  else window.addEventListener("load", scheduleIdlePreload, { once: true });
}
