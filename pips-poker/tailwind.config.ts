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
          DEFAULT: "#0b3d2e",
          dark: "#072a20",
          light: "#0f5c43",
        },
        chip: {
          red: "#c0392b",
          blue: "#2980b9",
          black: "#1c1c1c",
          gold: "#d4af37",
        },
      },
      boxShadow: {
        table: "inset 0 0 120px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
export default config;
