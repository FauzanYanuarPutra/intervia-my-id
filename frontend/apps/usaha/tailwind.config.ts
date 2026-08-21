import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,jsx,ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        portal: {
          paper: '#fffaf0',
          sand: '#efe0c2',
          ink: '#1f2937',
          soft: '#6b7280',
          line: '#d6c7af',
          forest: '#1d6a43',
          amber: '#c88d2f',
          ember: '#b45309',
        },
      },
      boxShadow: {
        card: '0 24px 60px -36px rgba(31, 41, 55, 0.28)',
      },
    },
  },
  plugins: [],
};

export default config;
