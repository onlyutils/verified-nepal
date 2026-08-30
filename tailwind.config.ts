import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Nepal flag: crimson field, blue border, white symbols.
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
          // Measured 11.3:1 and 6.9:1 against the #001B47 navy surface.
          onDark: "#C8D4EA",
          onDarkMuted: "#93A7CA",
          white: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: [
          '"Noto Sans Devanagari"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      letterSpacing: {
        display: "-0.035em",
      },
      boxShadow: {
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
