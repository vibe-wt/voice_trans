import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#eef3f8",
        foreground: "#102235",
        surface: "#fbfdff",
        border: "#d7e1ec",
        muted: "#5a7188",
        accent: "#0f4c81",
        accentForeground: "#f6fbff",
        success: "#197a55",
        danger: "#a53d3d"
      },
      boxShadow: {
        panel: "0 24px 60px rgba(10, 29, 52, 0.10)"
      },
      backgroundImage: {
        "app-grid":
          "radial-gradient(circle at top, rgba(15, 76, 129, 0.10), transparent 40%), linear-gradient(rgba(255, 255, 255, 0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.45) 1px, transparent 1px)"
      },
      backgroundSize: {
        "app-grid": "auto, 24px 24px, 24px 24px"
      }
    }
  },
  plugins: []
};

export default config;
