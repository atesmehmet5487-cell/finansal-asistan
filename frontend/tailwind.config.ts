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
          primary: "#0A0F1E",
          secondary: "#111827",
          card: "#141E2E",
        },
        border: {
          DEFAULT: "#1E2A3A",
          accent: "#2A3F5F",
        },
        accent: {
          cyan: "#00D4FF",
          "cyan-dim": "#00D4FF33",
        },
        positive: {
          DEFAULT: "#00FF94",
          dim: "#00FF9420",
        },
        negative: {
          DEFAULT: "#FF4545",
          dim: "#FF454520",
        },
        neutral: {
          gold: "#FFB800",
          "gold-dim": "#FFB80020",
        },
        text: {
          primary: "#E2E8F0",
          secondary: "#94A3B8",
          muted: "#475569",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "price-up": "priceFlash 0.6s ease-out",
        "price-down": "priceFlashRed 0.6s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        priceFlash: {
          "0%": { backgroundColor: "#00FF9433" },
          "100%": { backgroundColor: "transparent" },
        },
        priceFlashRed: {
          "0%": { backgroundColor: "#FF454533" },
          "100%": { backgroundColor: "transparent" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px #00D4FF33" },
          "100%": { boxShadow: "0 0 20px #00D4FF66, 0 0 40px #00D4FF22" },
        },
      },
      backgroundImage: {
        "grid-pattern": "radial-gradient(circle, #1E2A3A 1px, transparent 1px)",
        "hero-gradient": "radial-gradient(ellipse at top, #0F1F3D 0%, #0A0F1E 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
