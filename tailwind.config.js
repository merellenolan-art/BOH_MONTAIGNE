/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Anthracite dark surface palette
        graphite: {
          50: "#222429",
          100: "#2a2d33",
          200: "#353840",
          300: "#3f434c",
          400: "#6b707a",
          500: "#A8ABB2",
          600: "#c2c5cb",
          700: "#dcdde0",
          800: "#ebecee",
          900: "#F2F2EE",
          950: "#101114",
        },
        // Discreet green accent
        house: {
          50: "#1e2a22",
          100: "#243329",
          200: "#2e4334",
          300: "#3f5a47",
          400: "#536d57",
          500: "#667B6B",
          600: "#7d9081",
          700: "#9aa89c",
          800: "#c0c8c1",
          900: "#e6eae7",
        },
        // Steel blue-grey accent
        steel: {
          50: "#1e2a33",
          100: "#24323d",
          200: "#2c3d49",
          300: "#3a4f5e",
          400: "#4d6477",
          500: "#6b8194",
          600: "#94a8b8",
          700: "#bccad5",
          800: "#dde5eb",
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0, 0, 0, 0.3), 0 3px 10px rgba(0, 0, 0, 0.25)",
        lift: "0 4px 8px rgba(0, 0, 0, 0.3), 0 12px 28px rgba(0, 0, 0, 0.4)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};
