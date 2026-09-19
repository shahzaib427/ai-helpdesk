/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16282F",
        slate: { 550: "#4A6068" },
        wash: "#EBEEEA",
        paper: "#FFFFFF",
        pine: { DEFAULT: "#14594A", dark: "#0E4238", light: "#E3EFEA" },
        clay: { DEFAULT: "#A8432A", light: "#F8E7E2" },
        amber: { DEFAULT: "#9A6714", light: "#F7EEDC" },
      },
      fontFamily: {
        sans: ["Instrument Sans", "system-ui", "Segoe UI", "sans-serif"],
        display: ["Newsreader", "Georgia", "serif"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(22,40,47,0.06), 0 8px 24px -12px rgba(22,40,47,0.18)",
      },
    },
  },
  plugins: [],
};
