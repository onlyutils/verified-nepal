/**
 * The OnlyUtils chat widget ships no theming hooks, but it renders into an open
 * shadow root and reads `--ouc-*` custom properties. So: set the variables on
 * the host, inject one stylesheet for the parts variables cannot reach, and stamp the
 * verifiedNepal mark plus the OnlyUtils credit into its DOM.
 */
const HOST_ID = "onyutils-chat-widget";
const ONLYUTILS_URL = "https://onlyutils.com";

const hostVars = {
  "--ouc-primary": "#A20D2B",
  "--ouc-primary-fg": "#F4EFE6",
  "--ouc-bg": "#F4EFE6",
  "--ouc-text": "#16130F",
  "--ouc-muted": "#6B655C",
  "--ouc-border": "#D9D2C5",
  "--ouc-assistant-bg": "#FFFFFF",
  "--ouc-radius": "0",
  "--ouc-radius-sm": "0",
  "--ouc-launcher-size": "56px",
  "--ouc-shadow": "0 12px 24px -16px rgba(22, 19, 15, 0.5)",
  "--ouc-font": 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", sans-serif',
};

/* Editorial theme: paper, ink, one red accent, hairlines, square geometry, no motion. */
const shadowCss = `
.ouc-launcher {
  background: #16130F;
  border: 1px solid #F4EFE6;
  border-radius: 0;
  box-shadow: 0 0 0 1px #16130F, 0 8px 20px -12px rgba(22, 19, 15, 0.6);
  overflow: hidden;
  padding: 0;
}
.ouc-launcher img { width: 30px; height: 30px; }

.ouc-panel {
  border: 1px solid #16130F;
  border-radius: 0;
  background: #F4EFE6;
}

.ouc-header {
  background: #F4EFE6;
  border-bottom: 4px double #16130F;
  gap: 10px;
}
.ouc-title {
  font-family: "Playfair Display", "Noto Serif Devanagari", Georgia, serif;
  font-weight: 700;
  letter-spacing: 0;
  color: #16130F;
}
.vn-chat-brand { display: flex; align-items: center; gap: 9px; flex: 1; min-width: 0; }
.vn-chat-brand img { width: 24px; height: 24px; flex: none; }

.ouc-msg { border: 1px solid transparent; border-radius: 0; }
.ouc-msg-assistant { background: #FFFFFF; border-color: #D9D2C5; border-left: 2px solid #A20D2B; }
.ouc-msg-user { background: #16130F; color: #F4EFE6; }
.ouc-msg strong { font-weight: 600; }
.ouc-tel {
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  color: #A20D2B;
}

.ouc-chip {
  background: transparent;
  border: 1px solid #16130F;
  border-radius: 0;
  color: #16130F;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
}
.ouc-chip:hover { background: #16130F; color: #F4EFE6; border-color: #16130F; }

.ouc-composer { border-top: 1px solid #D9D2C5; background: #F4EFE6; }
.ouc-input { background: #FFFFFF; border: 1px solid #D9D2C5; border-radius: 0; color: #16130F; }
.ouc-input:focus-visible { outline: none; border-color: #16130F; box-shadow: 0 0 0 2px rgba(162, 13, 43, 0.25); }
.ouc-mic { background: #FFFFFF; border-radius: 0; color: #6B655C; }
.ouc-send { background: #16130F; border-radius: 0; color: #F4EFE6; }
.ouc-send:hover:not(:disabled) { background: #A20D2B; }

.vn-chat-credit {
  flex: none;
  padding: 7px 12px 10px;
  text-align: center;
  font-size: 11px;
  line-height: 1.4;
  color: #6B655C;
  border-top: 1px solid #D9D2C5;
}
.vn-chat-credit a { color: #16130F; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
`;

function decorate(root: ShadowRoot) {
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

export function openChatWidget() {
  const root = document.getElementById(HOST_ID)?.shadowRoot;
  const panel = root?.querySelector(".ouc-panel");
  // The launcher toggles, so only click it when the panel is closed.
  if (panel && !panel.classList.contains("ouc-open")) {
    root?.querySelector<HTMLButtonElement>(".ouc-launcher")?.click();
  }
}


/**
 * Feed the visitor's selected district into the OnlyUtils widget as
 * conversation context (window.OnyutilsChat.setContext, shipped 2026-08-30).
 * Applies the persisted choice at boot and follows vn:region-change events.
 * No-ops gracefully on older widget bundles without the global.
 */
export function wireRegionContext() {
  const send = (region: string) => {
    const api = (window as Window & { OnyutilsChat?: { setContext?: (t: string) => void } }).OnyutilsChat;
    if (!api?.setContext) return;
    api.setContext(region ? `Visitor's selected district: ${region}` : "");
  };
  try {
    const saved = localStorage.getItem("vn:region");
    if (saved) send(saved);
  } catch {
    /* private mode */
  }
  window.addEventListener("vn:region-change", (event) => {
    send(String((event as CustomEvent<{ region?: string }>).detail?.region ?? ""));
  });
}
