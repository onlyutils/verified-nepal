import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Values live in src/styles.css as CSS variables so the high-contrast
        // mode (and prefers-contrast) can swap them without touching classes.
        paper: "rgb(var(--paper) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        rule: "rgb(var(--rule) / <alpha-value>)",
        red: "rgb(var(--red) / <alpha-value>)",
        blue: "rgb(var(--blue) / <alpha-value>)",
        white: "#FFFFFF",
      },
      fontFamily: {
        // Latin faces carry no Devanagari, so the browser falls through per glyph.
        // ponytail: labels use the system sans — on Android that IS Noto Sans Devanagari,
        // and it saves ~160 KB of webfont over shipping Plex + Noto Sans Devanagari.
        display: ['"Playfair Display"', '"Noto Serif Devanagari"', "Georgia", "serif"],
        serif: ['"Source Serif 4"', '"Noto Serif Devanagari"', "Georgia", "serif"],
        sans: ["system-ui", "-apple-system", '"Segoe UI"', "Roboto", '"Noto Sans Devanagari"', "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
