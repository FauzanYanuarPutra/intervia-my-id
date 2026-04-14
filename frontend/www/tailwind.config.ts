import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import tailwindcssAnimate from 'tailwindcss-animate';

const lajukanGreen = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
  950: '#052e16',
};

const lajukanOrange = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#f97316',
  600: '#ea580c',
  700: '#c2410c',
  800: '#9a3412',
  900: '#7c2d12',
  950: '#431407',
};

const lajukanSky = {
  50: '#f0f9ff',
  100: '#e0f2fe',
  200: '#bae6fd',
  300: '#7dd3fc',
  400: '#38bdf8',
  500: '#0ea5e9',
  600: '#0284c7',
  700: '#0369a1',
  800: '#075985',
  900: '#0c4a6e',
  950: '#082f49',
};

const lajukanBlue = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
  950: '#172554',
};

const lajukanCyan = {
  50: '#ecfeff',
  100: '#cffafe',
  200: '#a5f3fc',
  300: '#67e8f9',
  400: '#22d3ee',
  500: '#06b6d4',
  600: '#0891b2',
  700: '#0e7490',
  800: '#155e75',
  900: '#164e63',
  950: '#083344',
};

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './dist/**/*.{js,jsx,ts,tsx}',
    './node_modules/lajukan-ui/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
      },
      fontFamily: {
        sans: ['var(--font-family)', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        lajukan: lajukanGreen,
        emerald: lajukanGreen,
        green: lajukanGreen,
        orange: lajukanOrange,
        sky: lajukanSky,
        blue: lajukanBlue,
        cyan: lajukanCyan,
        brand: {
          primary: '#16A34A',
          primaryLight: '#22C55E',
          primaryDark: '#15803D',
          secondary: '#F97316',
          secondaryLight: '#FB923C',
          secondaryDark: '#EA580C',
          accent: '#0EA5E9',
          neutral: {
            50: '#F8FAFC',
            100: '#F1F5F9',
            200: '#E2E8F0',
            300: '#CBD5E1',
            400: '#94A3B8',
            500: '#64748B',
            600: '#475569',
            700: '#334155',
            800: '#1E293B',
            900: '#0F172A',
          },
          'profit-skill': '#16A34A',
          'profit-micro': '#65A30D',
          'profit-content': '#0EA5E9',
          'profit-invest': '#0284C7',
        },

        surface: {
          light: '#FFFFFF',
          dark: '#0B1220',
          overlay: '#08111D',
          panel: '#0F172A',
          'light-panel': '#F8FAFC',
        },

        text: {
          primary: '#0F172A',
          secondary: '#475569',
          inverse: '#FFFFFF',
          dark: '#E2E8F0',
          'dark-secondary': '#94A3B8',
        },

        status: {
          success: '#16A34A',
          warning: '#F97316',
          danger: '#EF4444',
          info: '#0EA5E9',
        },
      },

      boxShadow: {
        buttonLight: '0 2px 8px rgba(22, 163, 74, 0.26)',
        buttonDark: '0 2px 8px rgba(34, 197, 94, 0.8)',
        inputFocus: '0 0 0 2px #16A34A',
        header: '0 0 0 1px rgba(0,0,0,0.1), 0 8px 20px rgba(0,0,0,0.08)',
        headerDark:
          '0 0 0 1px rgba(255,255,255,0.05), 0 8px 20px rgba(0,0,0,0.4)',
        '2xl':
          '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.15)',
        '3xl': '0 35px 60px -15px rgba(0, 0, 0, 0.35)',
      },

      borderRadius: {
        xs: '0.5rem',
        sm: '0.75rem',
        DEFAULT: '0.375rem',
        md: '1rem',
        lg: '1.25rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '1.75rem',
        '4xl': '2rem',
        full: '9999px',
      },

      zIndex: {
        default: '5',
        header: '10',
        sidebar: '13',
        bottomNavbar: '9',
        loading: '998',
        bgBlur: '12',
        modal: '14',
        preview: '10',
        thumbnailPreview: '1000',
        notFound: '100',
        offline: '999',
        overlay: '998',
      },

      keyframes: {
        'bg-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
      },
      animation: {
        'bg-shift': 'bg-shift 20s ease infinite',
        'pulse-slow': 'pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      opacity: {
        disabled: '0.5',
      },

      height: {
        'svh-screen': '100svh',
      },
    },
  },

  plugins: [forms, typography, tailwindcssAnimate],
};

export default config;
