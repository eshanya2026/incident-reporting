/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        hospital: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fc',
          400: '#36a9f7',
          500: '#0c8ce9',
          600: '#006ec7',
          700: '#0258a2',
          800: '#064b86',
          900: '#0b3f6f',
          950: '#07284a',
        },
        emergency: {
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        warning: {
          500: '#f59e0b',
          600: '#d97706',
        },
        success: {
          500: '#10b981',
          600: '#059669',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
