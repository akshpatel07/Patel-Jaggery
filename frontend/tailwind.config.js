/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7e6',
          100: '#d9edbe',
          200: '#b8dc90',
          300: '#8fc85b',
          400: '#6dba32',
          500: '#4d9e1a',
          600: '#2d5016',
          700: '#1e3a0e',
          800: '#122508',
          900: '#091203',
        },
        cream: {
          50: '#fdfaf4',
          100: '#fdf8f0',
          200: '#faf0dc',
          300: '#f5e4c0',
          400: '#edd09a',
        },
        gold: {
          400: '#d4a017',
          500: '#b8860b',
          600: '#9a7209',
        },
        brown: {
          400: '#8b5e3c',
          500: '#6b4423',
          600: '#4a2f17',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
