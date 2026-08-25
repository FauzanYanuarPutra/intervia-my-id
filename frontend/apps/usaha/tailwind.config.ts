import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,jsx,ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        portal: {
          paper: '#ffffff',
          sand: '#eee7d7',
          mist: '#edf4ef',
          ink: '#17211c',
          soft: '#66736c',
          line: '#dce4de',
          forest: '#17613d',
          forestDark: '#104c30',
          amber: '#c88d2f',
          ember: '#b45309',
        },
      },
      boxShadow: {
        card: '0 16px 40px -30px rgba(15, 23, 42, 0.28)',
      },
    },
  },
  plugins: [],
};

export default config;
