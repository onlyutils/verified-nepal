/**
 * The OnlyUtils chat widget ships no branding or theming hooks, but it renders into
 * an open shadow root and reads `--ouc-*` custom properties. So: set the variables on
 * the host, inject one stylesheet for the parts variables cannot reach, and stamp the
 * verifiedNepal mark plus the OnlyUtils credit into its DOM.
 */
const HOST_ID = "onyutils-chat-widget";
const ONLYUTILS_URL = "https://onlyutils.com";

const hostVars = {
  "--ouc-primary": "#003893",
  "--ouc-primary-fg": "#ffffff",
  "--ouc-bg": "#0b1220",
  "--ouc-text": "#e8edf7",
  "--ouc-muted": "#93a4c4",
  "--ouc-border": "rgba(255,255,255,0.12)",
  "--ouc-assistant-bg": "rgba(255,255,255,0.06)",
  "--ouc-radius": "16px",
  "--ouc-radius-sm": "10px",
  "--ouc-launcher-size": "60px",
  "--ouc-shadow": "0 24px 60px -20px rgba(0,20,60,0.75)",
  "--ouc-font": '"Noto Sans Devanagari", ui-sans-serif, system-ui, sans-serif',
};

const shadowCss = `
.ouc-launcher {
  background: radial-gradient(120% 120% at 30% 20%, #123a86 0%, #0b1220 70%);
  border: 1px solid rgba(125,211,252,0.35);
  box-shadow: 0 0 0 0 rgba(220,20,60,0.5), 0 14px 34px -10px rgba(0,20,60,0.8);
  animation: vn-halo 3.6s ease-out infinite;
  overflow: hidden;
  padding: 0;
}
.ouc-launcher img { width: 34px; height: 34px; }
@keyframes vn-halo {
  0%   { box-shadow: 0 0 0 0 rgba(220,20,60,0.45), 0 14px 34px -10px rgba(0,20,60,0.8); }
  70%  { box-shadow: 0 0 0 14px rgba(220,20,60,0), 0 14px 34px -10px rgba(0,20,60,0.8); }
  100% { box-shadow: 0 0 0 0 rgba(220,20,60,0), 0 14px 34px -10px rgba(0,20,60,0.8); }
}

.ouc-panel {
  border: 1px solid rgba(125,211,252,0.18);
  background:
    radial-gradient(90% 60% at 15% 0%, rgba(0,56,147,0.55) 0%, rgba(11,18,32,0) 60%),
    linear-gradient(180deg, #0d1626 0%, #0b1220 100%);
  backdrop-filter: blur(14px);
}

/* Flag-gradient hairline across the top of the header. */
.ouc-header {
  position: relative;
  background: linear-gradient(135deg, #001b47 0%, #003893 55%, #7a1030 100%);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  gap: 10px;
}
.ouc-header::after {
  content: "";
  position: absolute; left: 0; right: 0; bottom: 0; height: 2px;
  background: linear-gradient(90deg, #003893 0%, #003893 42%, #DC143C 42%, #DC143C 100%);
}
.ouc-title { letter-spacing: 0.01em; }
.vn-chat-brand { display: flex; align-items: center; gap: 9px; flex: 1; min-width: 0; }
.vn-chat-brand img { width: 26px; height: 26px; flex: none; }

.ouc-msg { border: 1px solid transparent; }
.ouc-msg-assistant { border-color: rgba(125,211,252,0.16); border-left: 2px solid #DC143C; }
.ouc-msg-user { background: linear-gradient(135deg, #003893 0%, #0b62e0 100%); }
.ouc-msg strong { font-weight: 600; }
.ouc-tel {
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  color: #DC143C;
}

.ouc-chip {
  background: rgba(125,211,252,0.06);
  border-color: rgba(125,211,252,0.4);
  color: #9ed4ff;
}
.ouc-chip:hover { background: #003893; color: #fff; border-color: #003893; }

.ouc-composer { border-top-color: rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }
.ouc-input { background: rgba(255,255,255,0.04); }
.ouc-input:focus-visible { outline: none; border-color: #7dd3fc; box-shadow: 0 0 0 3px rgba(125,211,252,0.18); }
.ouc-mic { background: rgba(255,255,255,0.04); color: #93a4c4; }
.ouc-send { background: linear-gradient(135deg, #003893 0%, #DC143C 100%); }
.ouc-send:hover:not(:disabled) { filter: brightness(1.12); }

.vn-chat-credit {
  flex: none;
  padding: 7px 12px 10px;
  text-align: center;
  font-size: 11px;
  line-height: 1.4;
  color: #7d8fb3;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.vn-chat-credit a { color: #cfe0ff; font-weight: 600; text-decoration: none; }
.vn-chat-credit a:hover { text-decoration: underline; }

@media (prefers-reduced-motion: reduce) {
  .ouc-launcher { animation: none; }
}
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
    wrap.innerHTML = '<img src="/brand/logo-mark-light.svg" alt="">';
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
