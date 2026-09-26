/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Redesign System
        maroon: {
          50: '#FDF2F2',
          100: '#FDE8E8',
          200: '#FBD5D5',
          300: '#F8B4B4',
          400: '#F98080',
          500: '#A8252C',
          600: '#8B1E23',
          700: '#68151A',
          800: '#521014',
          900: '#3D0A0D',
          dark: '#68151A',
          DEFAULT: '#8B1E23',
          light: '#A8252C',
        },
        brandRed: {
          50: '#FFF5F5',
          100: '#FDECEC',
          200: '#FCD4D4',
          300: '#F8A5A5',
          400: '#EF5350',
          500: '#E53935',
          600: '#C62828',
          700: '#B71C1C',
          800: '#8B1E23',
          900: '#5E1519',
          DEFAULT: '#C62828',
          bright: '#E53935',
          soft: '#FDECEC',
          veryLight: '#FFF5F5',
        },
        clinicalText: {
          primary: '#172033',
          secondary: '#64748B',
          muted: '#94A3B8',
        },
        clinicalBorder: '#E2E8F0',
        clinicalSuccess: {
          DEFAULT: '#159A68',
          bg: '#E8F7F0',
        },
        clinicalBlue: '#4677B8',
        neutralGray: '#94A3B8',
      },
      fontSize: {
        // Slightly larger than Tailwind's defaults (xs 12px, sm 14px) for readability
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.9375rem', { lineHeight: '1.4rem' }],
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 3px 12px rgba(15, 23, 42, 0.06)',
        'chart': '0 3px 14px rgba(15, 23, 42, 0.05)',
        'glow-red': '0 4px 20px -2px rgba(198, 40, 40, 0.25)',
        'button-red': '0 4px 14px 0 rgba(139, 30, 35, 0.35)',
      }
    },
  },
  plugins: [],
};

