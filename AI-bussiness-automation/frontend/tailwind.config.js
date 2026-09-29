/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bed0fd',
          300: '#90b2fb',
          400: '#5a89f7',
          500: '#3563f0',
          600: '#2445e4',
          700: '#1d34c9',
          800: '#1e2da3',
          900: '#1e2b80',
        },
      },
    },
  },
  plugins: [],
}
