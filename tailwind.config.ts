import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/** rgb(var(--token) / <alpha>) so `bg-primary/10` works. Values live in src/styles.css. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "80rem" } },
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground"), soft: token("primary-soft"), "soft-border": token("primary-soft-border") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground"), soft: token("destructive-soft") },
        success: { DEFAULT: token("success"), foreground: token("success-foreground"), soft: token("success-soft") },
        warning: { DEFAULT: token("warning"), foreground: token("warning-foreground"), soft: token("warning-soft") },
        subtle: token("subtle"),
        faint: token("faint"),
        border: token("border"),
        input: token("input"),
        ring: token("ring"),

        // Legacy aliases from the newsprint design. Do not use in new code; see docs/DESIGN-GUIDELINES.md.
        paper: token("background"),
        ink: token("foreground"),
        rule: token("border"),
        red: token("destructive"),
        blue: token("primary"),
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['"Noto Sans"', '"Noto Sans Devanagari"', "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
        // Legacy aliases: the site is single-family now. Do not use in new code.
        display: ['"Noto Sans"', '"Noto Sans Devanagari"', "system-ui", "sans-serif"],
        serif: ['"Noto Sans"', '"Noto Sans Devanagari"', "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: { "accordion-down": "accordion-down 0.2s ease-out", "accordion-up": "accordion-up 0.2s ease-out" },
    },
  },
  plugins: [animate],
} satisfies Config;
