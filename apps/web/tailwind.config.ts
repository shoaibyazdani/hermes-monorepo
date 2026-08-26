import type { Config } from "tailwindcss";

/**
 * Hermes Tailwind theme.
 *
 * Colours map onto the semantic CSS variables declared in `app/globals.css`,
 * so a token is defined exactly once and both Tailwind classes and raw CSS
 * (SVG fills, box-shadows) resolve to the same value.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Surfaces */
        surface: {
          base: "var(--bg-base)",
          deep: "var(--bg-deep)",
          DEFAULT: "var(--bg-surface)",
          raised: "var(--bg-raised)",
          glass: "var(--bg-glass)",
          inset: "var(--bg-inset)",
        },

        /* Primary HUD accent + status colours */
        hud: {
          cyan: "var(--accent)",
          "cyan-strong": "var(--accent-strong)",
          green: "var(--status-active)",
          amber: "var(--status-warn)",
          red: "var(--status-critical)",
          muted: "var(--status-neutral)",
          offline: "var(--status-offline)",
          /* Legacy alias — /apex and /command-center still use hud-amber for
             the orange accent; keep the original orange available by name. */
          orange: "var(--amber)",
        },

        /* Text */
        ink: {
          DEFAULT: "var(--text)",
          mute: "var(--text-mute)",
          faint: "var(--text-faint)",
          ghost: "var(--text-ghost)",
        },

        /* Borders */
        line: {
          DEFAULT: "var(--border)",
          soft: "var(--border-soft)",
          strong: "var(--border-strong)",
        },

        /* ── Legacy token names, preserved so Phase 2 markup keeps working ── */
        bg: {
          base: "var(--bg-base)",
          panel: "var(--bg-panel)",
        },
        hudcss: {
          "cyan-dim": "var(--border)",
          "cyan-faint": "var(--accent-wash)",
          "cyan-glow": "var(--accent-glow)",
          "amber-glow": "var(--amber-glow)",
        },
      },

      fontFamily: {
        hud: ["var(--font-hud)", "system-ui", "sans-serif"],
        data: ["var(--font-data)", "ui-monospace", "monospace"],
      },

      spacing: {
        "shell-nav": "var(--shell-nav-w)",
        "shell-nav-compact": "var(--shell-nav-w-compact)",
        topbar: "var(--shell-topbar-h)",
      },

      boxShadow: {
        panel: "var(--shadow-panel)",
        raised: "var(--shadow-raised)",
        "glow-cyan": "0 0 16px var(--accent-glow)",
        "glow-soft": "0 0 10px rgba(0, 217, 255, 0.22)",
      },

      transitionTimingFunction: {
        hud: "var(--ease-hud)",
      },

      keyframes: {
        hudPulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.42", transform: "scale(0.82)" },
        },
        hudBlink: {
          "0%, 45%": { opacity: "1" },
          "50%, 95%": { opacity: "0.25" },
          "100%": { opacity: "1" },
        },
        hudReveal: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        spinCW: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        spinCCW: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(-360deg)" },
        },
        blinkCursor: {
          "50%": { opacity: "0" },
        },
      },

      animation: {
        "pulse-dot": "hudPulse 2s ease-in-out infinite",
        "status-blink": "hudBlink 2.4s ease-in-out infinite",
        reveal: "hudReveal 560ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "spin-cw": "spinCW 22s linear infinite",
        "spin-cw-slow": "spinCW 34s linear infinite",
        "spin-ccw": "spinCCW 44s linear infinite",
        "blink-cursor": "blinkCursor 1s step-end infinite",
      },
    },
  },
  plugins: [],
};

export default config;
