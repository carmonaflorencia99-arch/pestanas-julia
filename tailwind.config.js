/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#EAF6F1',
          100: '#D1EBE1',
          200: '#A8DAC7',
          300: '#7CC7AC',
          400: '#56B192',
          500: '#3C9A7B',
          600: '#2F7F65',
          700: '#235F4C',
          800: '#1B4A3B',
          900: '#123329',
        },
        blush: {
          50: '#FDF1F4',
          100: '#FBDEE6',
          200: '#F6C0D0',
          300: '#EF9FB6',
          400: '#E67B9C',
          500: '#D65C82',
          600: '#B9436A',
        },
        ink: '#2B2422',
        paper: '#FBFBF8',
      },
    },
  },
  plugins: [],
};
