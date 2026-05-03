import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080a0f",
        panel: "#11151d",
        line: "#27303d",
        cyan: "#39d9ff",
        mint: "#5ee4a8",
        amber: "#f5c451",
        rose: "#ff607d"
      },
      boxShadow: {
        glow: "0 0 40px rgba(57,217,255,0.16)"
      }
    }
  },
  plugins: []
} satisfies Config;

