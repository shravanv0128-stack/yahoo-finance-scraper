import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: "#0c1410",
          dark: "#05080a",
          light: "#16241c",
        },
        chip: {
          red: "#ff4d4d",
          blue: "#2fd0ff",
          black: "#1c1c1c",
          gold: "#39ff8c",
        },
        neon: {
          DEFAULT: "#39ff8c",
          dim: "#0d6b3c",
          glow: "rgba(57,255,140,0.55)",
        },
      },
      boxShadow: {
        table: "inset 0 0 120px rgba(0,0,0,0.75), 0 0 60px rgba(57,255,140,0.12)",
        neon: "0 0 14px rgba(57,255,140,0.65), 0 0 4px rgba(57,255,140,0.9)",
      },
    },
  },
  plugins: [],
};
export default config;
