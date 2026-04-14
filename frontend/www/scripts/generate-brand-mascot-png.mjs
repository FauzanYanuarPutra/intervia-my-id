import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.join(process.cwd(), 'public', 'images', 'brand');
const outputFile = path.join(outputDir, 'laju-ride-mascot-v3.png');

const svg = `
<svg width="1200" height="1200" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#eef7ff" />
      <stop offset="48%" stop-color="#d9f0ff" />
      <stop offset="100%" stop-color="#f6fbff" />
    </linearGradient>
    <linearGradient id="halo" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#69b8ff" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#1f7ae0" stop-opacity="0.15" />
    </linearGradient>
    <linearGradient id="wing" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0f2f7d" />
    </linearGradient>
    <linearGradient id="body" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" />
      <stop offset="100%" stop-color="#2563eb" />
    </linearGradient>
    <linearGradient id="shirt" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde68a" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#0f172a" flood-opacity="0.18" />
    </filter>
  </defs>

  <rect width="1200" height="1200" rx="200" fill="url(#bg)" />
  <circle cx="845" cy="326" r="170" fill="url(#halo)" opacity="0.6" />
  <circle cx="368" cy="282" r="132" fill="#ffffff" opacity="0.92" />
  <path d="M162 847c136-96 302-132 468-108 91 13 184 48 282 43 57-3 110-20 162-51 9 108-44 182-159 223-106 37-226 36-338 18-144-24-302-68-415-82z" fill="#ffffff" opacity="0.72" />

  <g filter="url(#shadow)">
    <ellipse cx="625" cy="930" rx="255" ry="46" fill="#93c5fd" opacity="0.28" />

    <g transform="translate(180 180)">
      <path d="M654 342c79 14 143 68 178 142l28 59c17 37 0 80-37 97-38 17-81 1-98-36l-24-54c-12-27-35-47-64-52l-94-18 111-138z" fill="url(#wing)" />
      <path d="M312 274c-88 8-172 53-230 124l-46 57c-28 34-22 84 12 111 35 27 85 22 112-13l43-54c21-27 52-44 87-47l112-10-90-168z" fill="#1e40af" />

      <path d="M413 172c93 0 182 52 229 132 46 79 52 177 16 257-38 84-116 143-206 155-90 12-181-25-241-98-60-73-81-171-56-260 31-109 131-186 258-186z" fill="url(#body)" />
      <path d="M518 212c44 17 81 52 103 96 16 32 24 67 23 102-13-10-30-16-47-16-46 0-83 38-83 84 0 42 31 77 72 83-25 23-56 39-90 47-74 16-152-8-203-63-51-55-68-135-44-207 31-95 122-156 220-148 17 1 34 5 49 11z" fill="#3b82f6" />

      <path d="M392 240c29-27 76-39 123-31 53 9 101 42 130 88 3 6 7 12 10 18-29 28-68 46-111 46-87 0-159-74-152-162z" fill="#f8fafc" />
      <path d="M531 224c47 10 87 40 112 80-13 5-27 8-42 8-43 0-81-22-104-56 8-11 20-22 34-32z" fill="#1e3a8a" opacity="0.9" />

      <circle cx="560" cy="333" r="21" fill="#0f172a" />
      <circle cx="553" cy="326" r="6" fill="#ffffff" />
      <path d="M585 354c18 3 34 15 45 32-18 7-39 10-59 7l14-39z" fill="#f59e0b" />
      <path d="M583 351c28 0 49 12 63 30-18 16-43 27-70 30-22 2-41-2-57-14 13-12 25-27 36-46h28z" fill="#fbbf24" />

      <path d="M287 468c38-17 81-26 123-26h84c55 0 108 22 147 61l78 78c16 16 16 43 0 59-16 16-42 16-58 0l-64-63-50 81c-15 25-48 33-73 18-25-15-33-47-18-72l42-68h-73c-53 0-106-18-147-50l-38-29c-19-15-24-42-9-62 15-21 43-26 64-13l38 24 35-19z" fill="url(#shirt)" />

      <path d="M629 586l80-78 48 64-83 36-45-22z" fill="#1d4ed8" />
      <rect x="702" y="531" width="99" height="133" rx="28" transform="rotate(-10 702 531)" fill="#2563eb" />
      <rect x="724" y="552" width="56" height="16" rx="8" transform="rotate(-10 724 552)" fill="#bfdbfe" opacity="0.95" />
      <rect x="716" y="585" width="70" height="42" rx="18" transform="rotate(-10 716 585)" fill="#1e40af" />

      <path d="M357 650l-80 87c-22 24-59 26-83 4-24-22-26-59-4-83l91-99 76 91z" fill="#2563eb" />
      <path d="M507 687l65 123c16 30 4 67-26 83-30 16-67 5-83-25l-63-120 107-61z" fill="#1d4ed8" />
      <path d="M358 648l112 57-55 91-119-50 62-98z" fill="#f8fafc" />
      <path d="M463 703l102-58 52 99-109 66-45-107z" fill="#f8fafc" />
      <rect x="277" y="729" width="134" height="57" rx="28" transform="rotate(18 277 729)" fill="#f59e0b" />
      <rect x="492" y="781" width="131" height="57" rx="28" transform="rotate(-24 492 781)" fill="#f59e0b" />

      <circle cx="297" cy="508" r="18" fill="#ffffff" opacity="0.85" />
      <circle cx="780" cy="471" r="14" fill="#ffffff" opacity="0.82" />
      <path d="M206 308c49-52 115-87 186-99" stroke="#ffffff" stroke-width="20" stroke-linecap="round" opacity="0.42" />
      <path d="M749 279c49 24 90 60 120 104" stroke="#93c5fd" stroke-width="18" stroke-linecap="round" opacity="0.5" />
    </g>
  </g>
</svg>
`;

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });

  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.waitForTimeout(80);
  await page.screenshot({ path: outputFile, omitBackground: true });

  await page.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
