import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "Geist",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        background: "#fbfbf5",
        surface: "#ffffff",
        "surface-muted": "#f4f4ef",
        border: "#e4e4e7",
        primary: "#000000",
        secondary: "#71717a",
        muted: "#a1a1aa",
        "shade-30": "#d4d4d8",
        "shade-40": "#a1a1aa",
        "shade-50": "#71717a",
        "shade-70": "#3f3f46",
        accent: "#c1fbd4",
        "accent-soft": "#d4f9e0",
        success: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
      },
      boxShadow: {
        soft: "0 14px 34px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
