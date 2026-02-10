// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  // Keep these top-level configurations
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  
  // Remove the 'theme' object entirely from here
  theme: {
    extend: {},
  },
  
  // Keep your plugins
  plugins: [require("tailwindcss-animate")],
};

export default config;
