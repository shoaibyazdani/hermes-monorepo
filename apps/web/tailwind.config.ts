import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // JARVIS palette — defined as both Tailwind tokens AND CSS vars
        bg: {
          base: "#050810",
          panel: "rgba(8, 14, 26, 0.55)",
        },
        hud: {
          cyan: "#00D9FF",
          amber: "#FF6B35",
          red: "#ff3b30",
          green: "#10b981",
        },
        ink: {
          DEFAULT: "#e0f4ff",
          mute: "#94a3b8",
        },
        hudcss: {
          "cyan-dim": "rgba(0, 217, 255, 0.15)",
          "cyan-faint": "rgba(0, 217, 255, 0.06)",
          "cyan-glow": "rgba(0, 217, 255, 0.45)",
          "amber-glow": "rgba(255, 107, 53, 0.4)",
        },
      },
      fontFamily: {
        hud: ["var(--font-hud)", "system-ui", "sans-serif"],
        data: ["var(--font-data)", "monospace"],
      },
      keyframes: {
        scanLineDrift: {
          "0%":   { transform: "translateY(-60px)" },
          "100%": { transform: "translateY(100vh)" },
        },
        glitchIn: {
          "0%":   { opacity: "0", transform: "translateX(-3px)", filter: "blur(4px)" },
          "20%":  { opacity: "0.4", transform: "translateX(2px)", filter: "blur(2px)" },
          "40%":  { opacity: "0.7", transform: "translateX(-2px)", filter: "blur(1px)" },
          "60%":  { opacity: "0.85", transform: "translateX(1px)", filter: "none" },
          "100%": { opacity: "1", transform: "none", filter: "none" },
        },
        spinCW: {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        spinCCW: {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(-360deg)" },
        },
        shimmer: {
          "0%":   { "background-position": "-100% -100%" },
          "100%": { "background-position": "200% 200%" },
        },
        blinkCursor: {
          "50%":  { opacity: "0" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.5", transform: "scale(0.85)" },
        },
      },
      animation: {
        "scan-line": "scanLineDrift 8s linear infinite",
        glitch: "glitchIn 0.4s ease-out",
        "spin-cw": "spinCW 12s linear infinite",
        "spin-cw-slow": "spinCW 18s linear infinite",
        "spin-ccw": "spinCCW 24s linear infinite",
        shimmer: "shimmer 4s linear infinite",
        "blink-cursor": "blinkCursor 1s step-end infinite",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
      },
      backgroundImage: {
        "scan-line": "linear-gradient(180deg, transparent 0%, rgba(0, 217, 255, 0.04) 40%, rgba(0, 217, 255, 0.18) 50%, rgba(0, 217, 255, 0.04) 60%, transparent 100%)",
        "hud-shimmer": "linear-gradient(105deg, transparent 35%, rgba(0, 217, 255, 0.15) 50%, transparent 65%)",
      },
    },
  },
  plugins: [],
};

export default config;
