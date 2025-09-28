/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aqua: {
          DEFAULT: '#00A6D6',
          50: '#E5F8FD',
          100: '#C0EEF9',
          200: '#8AE0F3',
          300: '#52D1ED',
          400: '#21C2E6',
          500: '#00A6D6',
          600: '#0083AB',
          700: '#006280',
          800: '#004355',
          900: '#00252C'
        },
        steel: {
          50: '#F5F7FA',
          100: '#E6EBF1',
            200: '#CCD5DF',
            300: '#B3C0CC',
            400: '#7A8D9C',
            500: '#586875',
            600: '#44515C',
            700: '#2F3B46',
            800: '#1D252C',
            900: '#101519'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)'
      }
    },
  },
  plugins: [],
}