import type { Config } from 'tailwindcss';

// Tokens de docs/VIVECUU_MASTER.md sección 7
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#FFFFFF',
        surface: '#F6F7F9',
        ink: '#1F2328',
        'ink-2': '#5F6B7A',
        brand: '#7C5CFF',
        primary: '#3D5AFE',
        accent: '#00D1FF',
        sos: '#E5252A',
        traffic: {
          free: '#34A853',
          mod: '#FBBC04',
          heavy: '#F57C00',
          stop: '#C5221F',
        },
        school: '#8E44AD',
      },
      borderRadius: { card: '16px' },
      boxShadow: { float: '0 4px 16px rgba(0,0,0,.08)', sheet: '0 -4px 24px rgba(0,0,0,.10)' },
      fontFamily: { sans: ['var(--font-inter)', 'system-ui', 'sans-serif'] },
      fontSize: { xs2: ['12px', '16px'], sm2: ['14px', '20px'], base2: ['16px', '22px'], lg2: ['20px', '26px'], xl2: ['28px', '34px'] },
      keyframes: {
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'toast-in': { from: { transform: 'translateY(-16px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        pulso: { '0%': { transform: 'scale(1)', opacity: '.6' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
        onda: { '0%,100%': { transform: 'scaleY(.3)' }, '50%': { transform: 'scaleY(1)' } },
      },
      animation: {
        'slide-up': 'slide-up .28s cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in .2s ease-out',
        'toast-in': 'toast-in .3s ease-out',
        pulso: 'pulso 1.6s ease-out infinite',
        onda: 'onda 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
