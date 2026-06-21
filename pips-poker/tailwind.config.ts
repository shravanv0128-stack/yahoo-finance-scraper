import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // PokerNow palette: dark grey/black chrome around a flat green felt
        // table, white name plates, and gold/yellow chip accents.
        felt: {
          DEFAULT: "#1c6b46", // table felt green
          dark: "#1b1c1f", // page/chrome background (dark grey, not black)
          light: "#2a2c30",
        },
        chip: {
          red: "#e0473e",
          blue: "#3b8fd6",
          black: "#1c1c1c",
          gold: "#f3c34d",
        },
        neon: {
          DEFAULT: "#f3c34d", // repurposed as the app's single accent color (gold)
          dim: "#9c7a2a",
          glow: "rgba(243,195,77,0.45)",
        },
      },
      boxShadow: {
        table: "inset 0 0 90px rgba(0,0,0,0.5)",
        neon: "0 0 10px rgba(243,195,77,0.4)",
      },
      keyframes: {
        fadein: {
          "0%": { opacity: "0", transform: "translateY(4px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        fadein: "fadein 0.35s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
