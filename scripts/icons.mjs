// アプリアイコンを SVG から生成（緑と黄緑の光の上にガラスのタイル、飛行機の軌跡とチェック）
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'public', 'icons');
await mkdir(out, { recursive: true });

const svg = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f6fbf1"/><stop offset="1" stop-color="#e3f3d4"/>
    </linearGradient>
    <radialGradient id="b1" cx="0.2" cy="0.18" r="0.62">
      <stop offset="0" stop-color="#8fd6a0" stop-opacity=".8"/><stop offset="1" stop-color="#8fd6a0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="b2" cx="0.86" cy="0.9" r="0.6">
      <stop offset="0" stop-color="#cbe87a" stop-opacity=".75"/><stop offset="1" stop-color="#cbe87a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".93"/><stop offset="1" stop-color="#ffffff" stop-opacity=".58"/>
    </linearGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5cc47e"/><stop offset="1" stop-color="#1f7f42"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#b1)"/>
  <rect width="1024" height="1024" fill="url(#b2)"/>
  <g transform="translate(${pad} ${pad}) scale(${(1024 - pad * 2) / 1024})">
    <rect x="212" y="212" width="600" height="600" rx="170" fill="url(#glass)" stroke="#ffffff" stroke-width="10"/>
    <path d="M318 640 C 420 560, 520 520, 640 470" fill="none" stroke="url(#ink)" stroke-width="22" stroke-linecap="round" stroke-dasharray="2 46" opacity=".75"/>
    <path d="M372 536 L462 624 L668 400" fill="none" stroke="url(#ink)" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M664 336 l70 -26 c14 -5 28 7 22 21 l-28 68 l20 52 l-22 10 l-34 -40 l-40 34 l6 30 l-16 8 l-24 -40 l-42 -22 l8 -16 l30 4 l32 -42 l-40 -32 Z" fill="url(#ink)"/>
  </g>
</svg>`;

const targets = [
  ['icon-180.png', 180, 0],
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['maskable-512.png', 512, 90],
];
for (const [name, size, pad] of targets) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(join(out, name));
}
await writeFile(join(out, 'icon.svg'), svg(0).trim());
console.log('icons generated');
