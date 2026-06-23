import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0A0B0D",
        carbon: "#141619",
        graphite: "#1F2226",
        ash: "#9AA3AD",
        bone: "#E6E8EB",
        trace: "#3DD8C0",
        "trace-deep": "#16A394",
        amber: "#E0A458",
        fault: "#E5484D",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "cursor-pulse": {
          "0%, 60%": { opacity: "1" },
          "61%, 100%": { opacity: "0.35" },
        },
        "trace-in": {
          from: { opacity: "0", transform: "translateY(2px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "cursor-pulse": "cursor-pulse 1.1s steps(1) infinite",
        "trace-in": "trace-in 140ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
