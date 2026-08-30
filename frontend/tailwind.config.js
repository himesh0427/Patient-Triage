/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        clinical: {
          50: "#f6f5f9",
          100: "#ebe8f1",
          200: "#d2cce2",
          300: "#b0a5cc",
          400: "#8f80b3",
          500: "#726099",
          600: "#5a4b7c",
          700: "#493c64",
          800: "#3d3251",
          900: "#322a42",
          950: "#211a2d",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 12px -2px rgba(0,0,0,0.08), 0 2px 6px -2px rgba(0,0,0,0.05)",
        "card-elevated": "0 8px 24px -4px rgba(0,0,0,0.1), 0 4px 8px -4px rgba(0,0,0,0.06)",
        glow: "0 0 12px rgba(239,68,68,0.15)",
        "glow-amber": "0 0 12px rgba(245,158,11,0.15)",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        barFill: {
          from: { width: "0%" },
          to: { width: "var(--bar-width)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-out",
        fadeInUp: "fadeInUp 0.35s ease-out",
        slideUp: "slideUp 0.4s ease-out",
        scaleIn: "scaleIn 0.25s ease-out",
        shimmer: "shimmer 1.8s infinite linear",
        pulseDot: "pulseDot 2s ease-in-out infinite",
        barFill: "barFill 0.8s ease-out forwards",
      },
    },
  },
  plugins: [],
};
