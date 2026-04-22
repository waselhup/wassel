import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './client/src/**/*.{js,jsx,ts,tsx}',
    './client/index.html',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          deep: 'var(--brand-deep)',
          soft: 'var(--brand-soft)',
        },
        surface: {
          DEFAULT: 'var(--bg)',
          off: 'var(--bg-off)',
          card: 'var(--bg-card)',
        },
        ink: {
          DEFAULT: 'var(--text)',
          body: 'var(--text-body)',
          dim: 'var(--text-dim)',
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
        },
        line: {
          DEFAULT: 'var(--border)',
          soft: 'var(--border-soft)',
          strong: 'var(--border-strong)',
        },
        wassel: {
          navy: '#1e3a5f',
          orange: '#ff6b35',
          teal: 'var(--brand)',
        },
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        sans: ['Inter', 'Cairo', 'sans-serif'],
        arabic: ['Cairo', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '10px',
        md: '12px',
        lg: '14px',
        xl: '16px',
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
