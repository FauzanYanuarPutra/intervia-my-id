import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.join(process.cwd(), 'public', 'images', 'home', 'menu');

const colors = {
  accent: '#2FBF4A',
  accentStrong: '#1E8F37',
  accentSoft: '#B8F0C8',
  text: '#1D2B1F',
  skin: '#F2C9A0',
};

const iconSvgs = [
  {
    name: 'ride',
    content: `
      <circle cx="20" cy="47" r="7" fill="${colors.accentStrong}" />
      <circle cx="46" cy="47" r="7" fill="${colors.accentStrong}" />
      <rect x="16" y="36" width="30" height="8" rx="4" fill="${colors.accent}" />
      <rect x="30" y="28" width="16" height="6" rx="3" fill="${colors.accent}" />
      <circle cx="32" cy="18" r="6" fill="${colors.skin}" />
      <path d="M26 18a6 6 0 0 1 12 0v3H26z" fill="${colors.accentStrong}" />
      <rect x="30" y="22" width="12" height="8" rx="3" fill="${colors.accent}" />
      <rect x="40" y="26" width="6" height="2" rx="1" fill="${colors.text}" />
    `,
  },
  {
    name: 'car',
    content: `
      <rect x="10" y="30" width="44" height="16" rx="8" fill="${colors.accent}" />
      <rect x="18" y="22" width="20" height="10" rx="5" fill="${colors.accentSoft}" />
      <circle cx="22" cy="48" r="6" fill="${colors.accentStrong}" />
      <circle cx="44" cy="48" r="6" fill="${colors.accentStrong}" />
      <circle cx="26" cy="26" r="4" fill="${colors.skin}" />
      <rect x="24" y="30" width="8" height="6" rx="2.5" fill="${colors.accentStrong}" />
      <rect x="40" y="34" width="8" height="2.5" rx="1.25" fill="${colors.text}" />
    `,
  },
  {
    name: 'food',
    content: `
      <rect x="10" y="28" width="26" height="8" rx="4" fill="${colors.accentSoft}" />
      <rect x="12" y="36" width="22" height="6" rx="3" fill="${colors.accentStrong}" />
      <rect x="10" y="42" width="26" height="8" rx="4" fill="${colors.accentSoft}" />
      <rect x="40" y="22" width="12" height="24" rx="4" fill="${colors.accent}" />
      <rect x="42" y="18" width="8" height="6" rx="3" fill="${colors.accentStrong}" />
      <rect x="24" y="31" width="6" height="2" rx="1" fill="${colors.text}" />
      <rect x="18" y="31" width="6" height="2" rx="1" fill="${colors.text}" />
    `,
  },
  {
    name: 'send',
    content: `
      <circle cx="18" cy="46" r="6.5" fill="${colors.accentStrong}" />
      <circle cx="42" cy="46" r="6.5" fill="${colors.accentStrong}" />
      <rect x="16" y="34" width="26" height="8" rx="4" fill="${colors.accent}" />
      <rect x="32" y="26" width="16" height="8" rx="3" fill="${colors.accent}" />
      <rect x="34" y="20" width="12" height="8" rx="2" fill="${colors.accentSoft}" />
      <circle cx="28" cy="20" r="5.5" fill="${colors.skin}" />
      <path d="M23 20a5 5 0 0 1 10 0v2H23z" fill="${colors.accentStrong}" />
      <rect x="26" y="24" width="10" height="6" rx="2.5" fill="${colors.accent}" />
    `,
  },
  {
    name: 'mart',
    content: `
      <rect x="12" y="22" width="40" height="26" rx="6" fill="${colors.accentSoft}" />
      <rect x="12" y="22" width="40" height="8" rx="4" fill="${colors.accent}" />
      <rect x="18" y="30" width="8" height="18" rx="3" fill="${colors.accentStrong}" />
      <rect x="30" y="30" width="18" height="14" rx="3" fill="${colors.accent}" />
      <rect x="34" y="42" width="10" height="6" rx="3" fill="${colors.accentSoft}" />
    `,
  },
  {
    name: 'services',
    content: `
      <circle cx="22" cy="22" r="6" fill="${colors.skin}" />
      <rect x="16" y="28" width="12" height="12" rx="4" fill="${colors.accent}" />
      <rect x="30" y="30" width="18" height="6" rx="3" fill="${colors.accentStrong}" />
      <circle cx="48" cy="33" r="5" fill="${colors.accentSoft}" />
      <rect x="44" y="32" width="8" height="2.5" rx="1.25" fill="${colors.text}" />
      <rect x="22" y="40" width="20" height="6" rx="3" fill="${colors.accent}" />
    `,
  },
  {
    name: 'jobs',
    content: `
      <rect x="14" y="16" width="28" height="34" rx="4" fill="${colors.accentSoft}" />
      <rect x="18" y="20" width="20" height="4" rx="2" fill="${colors.accent}" />
      <rect x="18" y="28" width="16" height="3" rx="1.5" fill="${colors.text}" />
      <rect x="18" y="34" width="16" height="3" rx="1.5" fill="${colors.text}" />
      <circle cx="46" cy="40" r="7" fill="${colors.accentStrong}" />
      <rect x="50" y="45" width="10" height="3" rx="1.5" fill="${colors.accentStrong}" />
    `,
  },
  {
    name: 'freelancer',
    content: `
      <circle cx="22" cy="20" r="6" fill="${colors.skin}" />
      <rect x="16" y="26" width="12" height="10" rx="4" fill="${colors.accent}" />
      <rect x="12" y="38" width="28" height="12" rx="4" fill="${colors.accentSoft}" />
      <rect x="16" y="41" width="20" height="6" rx="3" fill="${colors.accent}" />
      <circle cx="48" cy="22" r="6" fill="${colors.accentStrong}" />
      <rect x="46" y="28" width="4" height="6" rx="2" fill="${colors.accentStrong}" />
    `,
  },
  {
    name: 'produk',
    content: `
      <rect x="14" y="22" width="36" height="26" rx="6" fill="${colors.accentSoft}" />
      <rect x="18" y="18" width="28" height="10" rx="4" fill="${colors.accent}" />
      <rect x="24" y="30" width="16" height="12" rx="4" fill="${colors.accentSoft}" />
      <rect x="28" y="32" width="8" height="6" rx="3" fill="${colors.accentStrong}" />
    `,
  },
  {
    name: 'jasa',
    content: `
      <rect x="10" y="28" width="20" height="10" rx="5" fill="${colors.accent}" />
      <rect x="34" y="28" width="20" height="10" rx="5" fill="${colors.accent}" />
      <rect x="24" y="30" width="16" height="6" rx="3" fill="${colors.accentStrong}" />
      <circle cx="16" cy="26" r="4" fill="${colors.skin}" />
      <circle cx="48" cy="26" r="4" fill="${colors.skin}" />
      <rect x="26" y="38" width="12" height="8" rx="4" fill="${colors.accentSoft}" />
    `,
  },
  {
    name: 'pinjam',
    content: `
      <rect x="14" y="30" width="24" height="16" rx="4" fill="${colors.accent}" />
      <rect x="18" y="26" width="16" height="6" rx="3" fill="${colors.accentStrong}" />
      <circle cx="46" cy="34" r="7" fill="${colors.accentSoft}" />
      <rect x="42" y="42" width="10" height="4" rx="2" fill="${colors.accentStrong}" />
      <path d="M34 40c4 2 8 2 12 0" stroke="${colors.text}" stroke-width="2" stroke-linecap="round" />
    `,
  },
  {
    name: 'properti',
    content: `
      <path d="M16 30L32 16l16 14v18H16z" fill="${colors.accent}" />
      <rect x="26" y="34" width="12" height="14" rx="3" fill="${colors.accentStrong}" />
      <rect x="38" y="40" width="10" height="6" rx="3" fill="${colors.accentSoft}" />
    `,
  },
  {
    name: 'umkm',
    content: `
      <rect x="12" y="24" width="40" height="22" rx="6" fill="${colors.accentSoft}" />
      <rect x="12" y="24" width="40" height="8" rx="4" fill="${colors.accent}" />
      <rect x="18" y="32" width="28" height="12" rx="4" fill="${colors.accent}" />
      <circle cx="32" cy="36" r="4" fill="${colors.skin}" />
      <rect x="29" y="40" width="6" height="6" rx="3" fill="${colors.accentStrong}" />
    `,
  },
  {
    name: 'edukasi',
    content: `
      <rect x="12" y="26" width="18" height="20" rx="4" fill="${colors.accentSoft}" />
      <rect x="34" y="26" width="18" height="20" rx="4" fill="${colors.accentSoft}" />
      <rect x="22" y="22" width="20" height="6" rx="3" fill="${colors.accent}" />
      <circle cx="32" cy="18" r="5" fill="${colors.skin}" />
      <path d="M24 16h16l-8 6z" fill="${colors.accentStrong}" />
    `,
  },
  {
    name: 'belajar',
    content: `
      <circle cx="24" cy="20" r="6" fill="${colors.skin}" />
      <rect x="18" y="26" width="12" height="10" rx="4" fill="${colors.accent}" />
      <rect x="12" y="38" width="20" height="12" rx="4" fill="${colors.accentSoft}" />
      <rect x="32" y="38" width="20" height="12" rx="4" fill="${colors.accentSoft}" />
      <rect x="18" y="41" width="28" height="6" rx="3" fill="${colors.accent}" />
    `,
  },
];

function buildSvg(content) {
  return `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stop-color="#63D37A" stop-opacity="0.65" />
          <stop offset="100%" stop-color="#0F1A12" stop-opacity="1" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" fill="url(#bg)" />
      <circle cx="256" cy="260" r="190" fill="#7AE08C" opacity="0.18" />
      <g transform="translate(64 64) scale(6)">
        <ellipse cx="32" cy="54" rx="18" ry="4" fill="#0B110C" opacity="0.25" />
        ${content}
      </g>
    </svg>
  `;
}

async function launchBrowser() {
  const channels = ['msedge', 'chrome'];
  for (const channel of channels) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (error) {
      if (channel === channels[channels.length - 1]) {
        throw error;
      }
    }
  }
  return chromium.launch({ headless: true });
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 2 });

  for (const icon of iconSvgs) {
    const svg = buildSvg(icon.content);
    await page.setContent(
      `<html><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#0F1A12;">${svg}</body></html>`
    );
    await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(outputDir, `${icon.name}.png`) });
  }

  await page.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
