/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './apps/web/index.html',
    './apps/web/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Wassel Color System
      colors: {
        wassel: {
          // Primary Blue
          blue: {
            50: '#F0F9FF',
            100: '#E0F2FE',
            200: '#BAE6FD',
            300: '#7DD3FC',
            400: '#38BDF8',
            500: '#0EA5E9',
            600: '#0284C7',
            700: '#0369A1',
            800: '#075985',
            900: '#0C3D66',
            // Deep Confident Blue (Primary)
            primary: '#1E40AF',
            'primary-light': '#DBEAFE',
            'primary-dark': '#1E3A8A',
          },
          // Neutral Grays
          gray: {
            50: '#F9FAFB',
            100: '#F3F4F6',
            200: '#E5E7EB',
            300: '#D1D5DB',
            400: '#9CA3AF',
            500: '#6B7280',
            600: '#4B5563',
            700: '#374151',
            800: '#1F2937',
            900: '#111827',
          },
          // Success Green
          success: '#10B981',
          'success-light': '#D1FAE5',
          'success-dark': '#047857',
          // Warning Amber
          warning: '#F59E0B',
          'warning-light': '#FEF3C7',
          'warning-dark': '#D97706',
          // Error Red
          error: '#EF4444',
          'error-light': '#FEE2E2',
          'error-dark': '#DC2626',
          // Info Blue
          info: '#3B82F6',
          'info-light': '#DBEAFE',
          'info-dark': '#1D4ED8',
        },
      },

      // Typography System
      fontFamily: {
        // Arabic first (RTL)
        arabic: ['Tajawal', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        // English fallback
        english: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        // Default (uses Arabic for RTL, English for LTR)
        sans: ['Tajawal', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        // Display
        display: ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        // Headings
        h1: ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['24px', { lineHeight: '1.2', fontWeight: '600' }],
        h3: ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        h4: ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        // Body
        'body-lg': ['18px', { lineHeight: '1.5', fontWeight: '400' }],
        body: ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        // Caption
        caption: ['12px', { lineHeight: '1.4', fontWeight: '500' }],
      },

      fontWeight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },

      // Spacing System (8px base)
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
        '3xl': '64px',
        '4xl': '80px',
        '5xl': '96px',
      },

      // Border Radius
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },

      // Shadows (Elevation System)
      boxShadow: {
        none: 'none',
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px rgba(0, 0, 0, 0.15)',
        // Focus shadow
        focus: '0 0 0 3px rgba(30, 64, 175, 0.1), 0 0 0 1px rgba(30, 64, 175, 0.5)',
      },

      // Transitions
      transitionDuration: {
        fast: '150ms',
        normal: '300ms',
        slow: '500ms',
      },

      transitionTimingFunction: {
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      // Gradients
      backgroundImage: {
        'gradient-premium': 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
        'gradient-soft': 'linear-gradient(135deg, #DBEAFE 0%, #F3F4F6 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)',
      },

      // Container
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '6rem',
          '2xl': '8rem',
        },
      },

      // Screen sizes
      screens: {
        xs: '320px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
    },
  },

  plugins: [
    // Custom plugin for RTL support
    function ({ addUtilities }) {
      addUtilities({
        '.rtl': {
          direction: 'rtl',
          textAlign: 'right',
        },
        '.ltr': {
          direction: 'ltr',
          textAlign: 'left',
        },
        '.text-right-rtl': {
          '@apply rtl:text-right ltr:text-left': {},
        },
      });
    },
  ],
};
