import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './client/src/**/*.{js,jsx,ts,tsx}',
    './client/index.html',
  ],
  theme: {
    extend: {
      colors: {
        wassel: {
          navy: '#1e3a5f',
          orange: '#ff6b35',
        },
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
  corePlugins: {
    direction: false,
  },
};

export default config;