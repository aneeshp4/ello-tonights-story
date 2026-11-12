// Ello brand tokens for Tailwind (v3 config; in Tailwind v4 load with `@config "../tailwind.config.ts";`)
// Values extracted from the Figma "Master" page. Mirrors styles/ello.css.
import type { Config } from "tailwindcss";

const scale = (darker: string, dark: string, base: string, light: string, lighter: string) => ({
  darker, dark, DEFAULT: base, light, lighter,
});

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: scale("#0F3A4D", "#175773", "#6B8B99", "#A3C0CC", "#DEEBF1"),
        teal: scale("#075948", "#008071", "#07A180", "#0AD3A1", "#75F0C0"),
        cyan: scale("#00A7A7", "#00C6C3", "#24D9D9", "#47F0EA", "#90FFF8"),
        sun: scale("#B85900", "#FF6F00", "#FFA100", "#FFC800", "#FFDD00"), // brand "Yellow"
        coral: scale("#800600", "#DE0700", "#FF562B", "#FF8D8D", "#FFB5B2"), // brand "Red"
        sky: scale("#0F02A0", "#4C93FF", "#3DC1FF", "#72DCFF", "#9CF0FF"), // brand "Blue"
        grape: scale("#4D0076", "#9B00EE", "#D256FF", "#F09BFF", "#FACAFF"), // brand "Purple"
        gray: { 800: "#2C3232", 700: "#647070", 500: "#9DA9AA", 300: "#C6CDCD", 200: "#C5CECE" },
        pastel: {
          cyan: "#E5FFFD", teal: "#E6FFF1", blue: "#CFFAFA", ink: "#F3F9FB",
          yellow: "#FBF9F3", red: "#FBF5F3", purple: "#FCF5FF", gray: "#F6F8F8",
        },
      },
      fontFamily: {
        sans: ["Wallop", "Nunito", "ui-rounded", "system-ui", "sans-serif"],
        story: ["Andika", "Nunito", "system-ui", "sans-serif"],
      },
      fontSize: {
        h1: ["2.5rem", { lineHeight: "1.28", letterSpacing: "-1px", fontWeight: "600" }],
        h3: ["1.5rem", { lineHeight: "1.4", fontWeight: "600" }],
        button: ["1.5rem", { lineHeight: "1", fontWeight: "600" }],
        input: ["1.25rem", { lineHeight: "1", fontWeight: "550" }],
        body: ["1rem", { lineHeight: "1.6", fontWeight: "450" }],
        "body-s": ["0.8125rem", { lineHeight: "1.6", fontWeight: "450" }],
        story: ["1.625rem", { lineHeight: "1.8", letterSpacing: "0.02em" }],
      },
      borderRadius: { ello: "20px", "ello-lg": "32px" },
      boxShadow: {
        press: "0 4px 0 #008071",
        "press-light": "0 4px 0 #75F0C0",
        card: "0 2px 0 #DEEBF1",
      },
    },
  },
} satisfies Config;
