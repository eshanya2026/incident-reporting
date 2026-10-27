/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Premium wine/burgundy system (deepened from the original brighter red for a more
        // upmarket feel; still the same hue family as the hospital logo, just richer and darker)
        maroon: {
          50: '#FBF6F0',
          100: '#F3E6D7',
          200: '#E9D3BC',
          300: '#DDBD9A',
          400: '#B06C5E',
          500: '#6E2129',
          600: '#5C1A22',
          700: '#3D0F16',
          800: '#39100F',
          900: '#200809',
          dark: '#3D0F16',
          DEFAULT: '#5C1A22',
          light: '#6E2129',
        },
        brandRed: {
          50: '#FAF3EC',
          100: '#F4E6D7',
          200: '#E9D3BC',
          300: '#DDBD9A',
          400: '#A8554F',
          500: '#9C3A42',
          600: '#7A2430',
          700: '#4F161C',
          800: '#5C1A22',
          900: '#2A0D0B',
          DEFAULT: '#7A2430',
          bright: '#9C3A42',
          soft: '#F4E6D7',
          veryLight: '#FAF3EC',
        },
        // Antique gold accent, pulled from the logo's caduceus — used sparingly for premium
        // touches (hero-banner accents, icons on dark surfaces, premium highlights)
        gold: {
          50: '#FBF3DE',
          100: '#F5E4B8',
          200: '#ECD08A',
          300: '#E0B85C',
          400: '#D4A954',
          500: '#C79A3E',
          600: '#AD8430',
          700: '#8A6A26',
          800: '#67501C',
          900: '#453514',
          DEFAULT: '#D4A954',
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
        'glow-red': '0 4px 20px -2px rgba(122, 36, 48, 0.25)',
        'button-red': '0 4px 14px 0 rgba(92, 26, 34, 0.35)',
      }
    },
  },
  plugins: [],
};

