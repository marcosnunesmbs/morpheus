/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        matrix: {
          bg: '#000000',
          base: '#0D0208',
          primary: '#003B00',
          secondary: '#008F11', // Darker Green
          highlight: '#00FF41', // Bright Green
          text: '#008F11',
        },
        zinc: {
           950: '#0c0c0c', 
        }
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
}
