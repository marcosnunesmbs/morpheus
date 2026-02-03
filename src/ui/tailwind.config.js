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
        azure: {
          bg: '#F0F4F8',
          surface: '#FFFFFF',
          primary: '#0066CC',
          secondary: '#4A90E2',
          accent: '#2196F3',
          border: '#B3D4FC',
          hover: '#E3F2FD',
          active: '#BBDEFB',
          text: {
            primary: '#1A1A1A',
            secondary: '#5C6B7D',
            muted: '#8899A8',
          },
        },
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
