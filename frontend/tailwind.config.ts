import type { Config } from 'tailwindcss';

// Configuration identique à celle du frontend d'origine (couleurs VIVA + police Plus Jakarta Sans)
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pine: { 50: '#f0fdf4', 100: '#dcfce7', 700: '#15803d', 800: '#166534', 900: '#0f382c', 950: '#0a261e' },
        sage: { 50: '#f5f8f6', 100: '#e8f0ec', 200: '#d1e1d8', 300: '#b0ccbe' },
        accent: { coral: '#ff6b6b', amber: '#f59e0b' },
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
