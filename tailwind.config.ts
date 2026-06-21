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
        background: "#f1f1f1",
        surface: "#ffffff",
        "surface-muted": "#f7f7f7",
        border: "#d9d9d9",
        primary: "#202223",
        secondary: "#616161",
        muted: "#8c9196",
        "shade-30": "#c9c9c9",
        "shade-40": "#8c9196",
        "shade-50": "#616161",
        "shade-70": "#303030",
        accent: "#e3f1df",
        "accent-soft": "#eaf4ff",
        success: "#108043",
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
