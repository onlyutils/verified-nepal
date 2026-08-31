import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF", // black-and-white newsprint: white page, near-black ink, grey hairlines
        ink: "#0A0A0A",
        muted: "#6B6B6B",
        rule: "#E3E3E3",
        red: "#A20D2B",
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
