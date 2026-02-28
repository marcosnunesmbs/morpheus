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
          bg: 'rgb(var(--matrix-bg) / <alpha-value>)',
          base: 'rgb(var(--matrix-base) / <alpha-value>)',
          primary: 'rgb(var(--matrix-primary) / <alpha-value>)',
          secondary: 'rgb(var(--matrix-secondary) / <alpha-value>)',
          highlight: 'rgb(var(--matrix-highlight) / <alpha-value>)',
          text: 'rgb(var(--matrix-text) / <alpha-value>)',
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
