import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        tc: {
          canvas: "var(--tc-canvas)",
          surface: "var(--tc-surface)",
          "surface-2": "var(--tc-surface-2)",
          "surface-3": "var(--tc-surface-3)",
          fg: "var(--tc-fg)",
          muted: "var(--tc-muted)",
          accent: "var(--tc-accent)",
          "accent-hover": "var(--tc-accent-hover)",
          "accent-fg": "var(--tc-accent-fg)",
          "accent-soft": "var(--tc-accent-soft)",
          border: "var(--tc-border)",
          "border-strong": "var(--tc-border-strong)",
          success: "var(--tc-success)",
          warning: "var(--tc-warning)",
          error: "var(--tc-error)",
          info: "var(--tc-info)",
          blue: "var(--tc-blue)",
          purple: "var(--tc-purple)",
          amber: "var(--tc-amber)",
          rose: "var(--tc-rose)",
          sidebar: "var(--tc-sidebar)",
          "sidebar-fg": "var(--tc-sidebar-fg)",
          "sidebar-muted": "var(--tc-sidebar-muted)",
        },
        emerald: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
      },
      boxShadow: {
        soft: "var(--tc-shadow-sm)",
        card: "var(--tc-shadow)",
        elevated: "var(--tc-shadow-lg)",
      },
      borderRadius: {
        tc: "var(--tc-radius)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out both",
        "scale-in": "scale-in 0.25s ease-out both",
        shimmer: "shimmer 1.4s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
