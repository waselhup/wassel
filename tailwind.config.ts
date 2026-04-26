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

        // v2 redesign tokens (phase2v4) — opt-in via these keys, do not collide with legacy
        teal: {
          50:  'var(--teal-50)',
          100: 'var(--teal-100)',
          300: 'var(--teal-300)',
          500: 'var(--teal-500)',
          600: 'var(--teal-600)',
          700: 'var(--teal-700)',
          900: 'var(--teal-900)',
        },
        v2: {
          ink:      'var(--ink)',
          'ink-2':  'var(--ink-2)',
          body:     'var(--body)',
          dim:      'var(--dim)',
          mute:     'var(--mute)',
          line:     'var(--line)',
          'line-2': 'var(--line-2)',
          surface:  'var(--surface)',
          canvas:   'var(--canvas)',
          'canvas-2': 'var(--canvas-2)',
          amber:    'var(--amber)',
          'amber-50': 'var(--amber-50)',
          rose:     'var(--rose)',
          'rose-50': 'var(--rose-50)',
          indigo:   'var(--indigo)',
          'indigo-50': 'var(--indigo-50)',
        },
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        sans: ['Inter', 'Cairo', 'sans-serif'],
        arabic: ['Cairo', 'sans-serif'],

        // v2 — exact stacks from tokens.css
        ar:   ['Cairo', 'Inter', 'system-ui', 'sans-serif'],
        en:   ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '10px',
        md: '12px',
        lg: '14px',
        xl: '16px',

        // v2 — namespaced so they don't override legacy sm/md/lg
        'v2-sm':   'var(--r-sm)',   // 6px
        'v2-md':   'var(--r-md)',   // 10px
        'v2-lg':   'var(--r-lg)',   // 14px
        'v2-xl':   'var(--r-xl)',   // 20px
        'v2-pill': 'var(--r-pill)', // 999px
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
      },
      transitionTimingFunction: {
        ios: 'var(--ease-ios)',
        out: 'var(--ease-out)',
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
