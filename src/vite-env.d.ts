/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_CHAT_WIDGET_SRC?: string;
  readonly VITE_CHAT_KEY?: string;
  readonly VITE_CHAT_API?: string;
}

interface Window {
  __vnRegion?: string;
}
