/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'alpine-teal': '#4A9E9E',
        'lake-blue': '#6BB6D6', 
        'fern-green': '#5B8C5A',
        'sandy-beige': '#F2E7D5',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
