import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Bricolage Grotesque", "sans-serif"],
      },
      colors: {
        // Solana brand palette
        "sol-purple": "#9945FF",
        "sol-green":  "#14F195",
        "sol-blue":   "#00C2FF",
      },
    },
  },
  plugins: [],
};

export default config;
