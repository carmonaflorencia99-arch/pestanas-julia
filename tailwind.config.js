/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(43,36,34,0.04), 0 8px 24px -12px rgba(43,36,34,0.12)',
        md: '0 2px 4px rgba(43,36,34,0.05), 0 16px 32px -16px rgba(43,36,34,0.18)',
        xl: '0 24px 60px -20px rgba(43,36,34,0.30)',
      },
      colors: {
        // grises cálidos (en vez del gris azulado de Tailwind) para un look más suave
        gray: {
          50: '#F8F7F5',
          100: '#F1EFEC',
          200: '#E6E3DF',
          300: '#D3CFCA',
          400: '#A8A29C',
          500: '#7D7771',
          600: '#5E5853',
          700: '#46413D',
          800: '#2F2B28',
          900: '#1F1C1A',
        },
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
        paper: '#F7F6F2',
      },
    },
  },
  plugins: [],
};
