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
          DEFAULT: "#1c6b46",
          dark: "#0a0d0b",
          light: "#2a2c30",
        },
        chip: {
          red: "#e0473e",
          blue: "#3b8fd6",
          black: "#1c1c1c",
          gold: "#f3c34d",
        },
        neon: {
          DEFAULT: "#f3c34d",
          dim: "#9c7a2a",
          glow: "rgba(243,195,77,0.45)",
        },
        felt2: {
          highlight: "#238257",
          shadow: "#123d28",
        },
      },
      boxShadow: {
        table: "inset 0 0 120px rgba(0,0,0,0.6)",
        neon: "0 0 10px rgba(243,195,77,0.4)",
        chip: "0 2px 0 rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.15) inset",
        rail: "0 8px 30px rgba(0,0,0,0.55), inset 0 2px 4px rgba(255,255,255,0.05)",
        glass: "0 8px 32px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
        "btn-fold": "0 0 16px rgba(220,38,38,0.4), 0 3px 10px rgba(0,0,0,0.5)",
        "btn-call": "0 0 16px rgba(34,197,94,0.4), 0 3px 10px rgba(0,0,0,0.5)",
        "btn-raise": "0 0 16px rgba(59,130,246,0.4), 0 3px 10px rgba(0,0,0,0.5)",
        "btn-allin": "0 0 16px rgba(243,195,77,0.5), 0 3px 10px rgba(0,0,0,0.5)",
      },
      keyframes: {
        fadein: {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        slideup: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseglow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        chipland: {
          "0%": { opacity: "0", transform: "translateY(-8px) scale(0.85)" },
          "70%": { opacity: "1", transform: "translateY(1px) scale(1.05)" },
          "100%": { transform: "translateY(0) scale(1)" },
        },
        deal: {
          "0%": { opacity: "0", transform: "translateY(-20px) rotate(-4deg) scale(0.88)" },
          "100%": { opacity: "1", transform: "translateY(0) rotate(0) scale(1)" },
        },
      },
      animation: {
        fadein: "fadein 0.3s cubic-bezier(0.22,1,0.36,1)",
        slideup: "slideup 0.4s cubic-bezier(0.22,1,0.36,1)",
        pulseglow: "pulseglow 2s cubic-bezier(0.4,0,0.6,1) infinite",
        chipland: "chipland 0.38s cubic-bezier(0.22,1,0.36,1)",
        deal: "deal 0.4s cubic-bezier(0.22,1,0.36,1)",
      },
    },
  },
  plugins: [],
};
export default config;
