import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--color-ink)",
          2: "var(--color-ink-2)",
          3: "var(--color-ink-3)",
        },
        paper: {
          DEFAULT: "var(--color-paper)",
          2: "var(--color-paper-2)",
          3: "var(--color-paper-3)",
        },
        dark: {
          bg: "var(--color-dark-bg)",
          surface: "var(--color-dark-surface)",
          border: "var(--color-dark-border)",
        },
        accent: {
          violet: "var(--color-accent-violet)",
          amber: "var(--color-accent-amber)",
          steel: "var(--color-accent-steel)",
        },
        success: "var(--color-success)",
        danger: "var(--color-danger)",
      },
      fontFamily: {
        ui: ["var(--font-ui)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
    },
  },
  plugins: [],
};
export default config;
