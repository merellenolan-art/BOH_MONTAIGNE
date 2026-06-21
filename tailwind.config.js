/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Graphite / steel neutrals — primary surface palette
        graphite: {
          50: "#f6f7f8",
          100: "#eceef1",
          200: "#d7dadd",
          300: "#b6bcc2",
          400: "#8b939c",
          500: "#677079",
          600: "#4d565f",
          700: "#3a424a",
          800: "#272d33",
          900: "#181c20",
          950: "#0e1114",
        },
        // Discreet Gucci green — used sparingly as accent only
        house: {
          50: "#f1f5f2",
          100: "#dde8e0",
          200: "#bcd2c2",
          300: "#93b59c",
          400: "#5f8a6c",
          500: "#3a6a48",
          600: "#2b5237",
          700: "#224129",
          800: "#1a3120",
          900: "#112118",
        },
        // Steel blue-grey accent for informational highlights
        steel: {
          50: "#f1f4f7",
          100: "#dde5eb",
          200: "#bccad5",
          300: "#94a8b8",
          400: "#6b8194",
          500: "#4d6477",
          600: "#3a4f5e",
          700: "#2c3d49",
          800: "#1e2a33",
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(24, 28, 32, 0.04), 0 3px 10px rgba(24, 28, 32, 0.05)",
        lift: "0 4px 8px rgba(24, 28, 32, 0.05), 0 12px 28px rgba(24, 28, 32, 0.08)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};
