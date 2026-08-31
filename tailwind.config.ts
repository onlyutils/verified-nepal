import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4EFE6",
        ink: "#16130F",
        muted: "#6B655C",
        rule: "#D9D2C5",
        red: "#A20D2B",
        white: "#FFFFFF",
        // ponytail: legacy palette kept until Task 8 so untouched pages still render.
        nepal: {
          crimson: "#DC143C",
          crimsonDeep: "#A20D2B",
          crimsonSoft: "#FFF1F4",
          blue: "#003893",
          blueDeep: "#001B47",
          blueSoft: "#EEF2FB",
          ink: "#0B1220",
          slate: "#4A5568",
          line: "#DCE3F0",
          mist: "#F5F7FC",
          onDark: "#C8D4EA",
          onDarkMuted: "#93A7CA",
          white: "#FFFFFF",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', '"Noto Serif Devanagari"', "Georgia", "serif"],
        serif: ['"Source Serif 4"', "Martel", '"Noto Serif Devanagari"', "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', '"Noto Sans Devanagari"', "system-ui", "sans-serif"],
      },
      letterSpacing: {
        display: "-0.035em",
      },
      boxShadow: {
        // ponytail: legacy, removed in Task 8.
        panel: "0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 32px -18px rgba(0, 27, 71, 0.35)",
        lift: "0 20px 48px -24px rgba(0, 27, 71, 0.55)",
      },
      backgroundImage: {
        flag: "linear-gradient(90deg, #003893 0%, #003893 42%, #DC143C 42%, #DC143C 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
