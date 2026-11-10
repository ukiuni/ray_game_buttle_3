// Renders the PWA icons (PNG) from an inline SVG using the locally installed Chrome.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const svg = pad => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="#5a1a52"/><stop offset=".55" stop-color="#22103a"/><stop offset="1" stop-color="#0a0514"/></radialGradient>
    <linearGradient id="sl" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#2ab8ff" stop-opacity="0"/><stop offset=".5" stop-color="#bff6ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
    <filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${pad}) translate(-256 -256)">
    <path d="M150 300 C150 190 215 130 256 130 C297 130 362 190 362 300 C362 345 325 392 256 392 C187 392 150 345 150 300Z" fill="#8a1a2c" stroke="#3c0c1c" stroke-width="10"/>
    <path d="M178 196 C150 150 128 104 142 62 C176 100 204 134 222 166Z" fill="#efe4c8" stroke="#3c0c1c" stroke-width="8"/>
    <path d="M334 196 C362 150 384 104 370 62 C336 100 308 134 290 166Z" fill="#efe4c8" stroke="#3c0c1c" stroke-width="8"/>
    <path d="M186 262 L238 286 L190 300Z" fill="#fff47a"/><path d="M326 262 L274 286 L322 300Z" fill="#fff47a"/>
    <path d="M206 352 L222 334 L238 356 L256 334 L274 356 L290 334 L306 352" fill="none" stroke="#efe4c8" stroke-width="10" stroke-linejoin="round"/>
    <path d="M70 430 C170 380 330 250 446 84" fill="none" stroke="#39c8ff" stroke-width="44" stroke-linecap="round" filter="url(#gl)" opacity=".9"/>
    <path d="M70 430 C170 380 330 250 446 84" fill="none" stroke="url(#sl)" stroke-width="20" stroke-linecap="round"/>
    <path d="M446 84 l-34 14 l22 20z" fill="#fff"/>
  </g>
</svg>`;
mkdirSync('public/icons', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
for (const [name, size, pad] of [['icon-192', 192, 1], ['icon-512', 512, 1], ['maskable-512', 512, 0.74], ['apple-touch-icon', 180, 0.92]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:#0a0514">${svg(pad)}</body>`);
  await page.screenshot({ path: `public/icons/${name}.png` });
  await page.close();
}
await browser.close();
console.log('icons written');
