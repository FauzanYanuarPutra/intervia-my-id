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
          sale: '#167A4A',
          saleTint: '#E9F6EF',
          catalog: '#6D5BD0',
          catalogTint: '#F0EEFF',
          stock: '#B86B16',
          stockTint: '#FFF3E3',
          money: '#2563A6',
          moneyTint: '#EAF2FB',
          success: '#15803D',
          successTint: '#ECFDF3',
          danger: '#B91C1C',
          dangerTint: '#FEF2F2',
          warning: '#A16207',
          warningTint: '#FFFBEB',
          info: '#1D4ED8',
          infoTint: '#EFF6FF',
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
