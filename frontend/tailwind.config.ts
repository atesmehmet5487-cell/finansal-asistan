import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   "#ECE4D0",
          secondary: "#E8DEC8",
          card:      "#F4ECD6",
        },
        border: {
          DEFAULT: "#D4CAB4",
          accent:  "#B8A98A",
        },
        accent: {
          cyan:       "#C2410C",
          "cyan-dim": "#C2410C22",
        },
        positive: {
          DEFAULT: "#059669",
          dim:     "#05966920",
        },
        negative: {
          DEFAULT: "#DC2626",
          dim:     "#DC262620",
        },
        neutral: {
          gold:      "#D97706",
          "gold-dim": "#D9770620",
        },
        text: {
          primary:   "#1B1814",
          secondary: "#4A4036",
          muted:     "#8C8270",
        },
      },
      fontFamily: {
        mono:  ["JetBrains Mono", "ui-monospace", "monospace"],
        sans:  ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        serif: ["Instrument Serif", "Georgia", "serif"],
      },
      animation: {
        "price-up":   "priceFlashGreen 0.6s ease-out",
        "price-down": "priceFlashRed 0.6s ease-out",
        "slide-in":   "slideIn 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        priceFlashGreen: {
          "0%":   { backgroundColor: "rgba(5,150,105,0.2)" },
          "100%": { backgroundColor: "transparent" },
        },
        priceFlashRed: {
          "0%":   { backgroundColor: "rgba(220,38,38,0.2)" },
          "100%": { backgroundColor: "transparent" },
        },
        slideIn: {
          "0%":   { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
