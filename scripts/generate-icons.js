#!/usr/bin/env node
/**
 * Generate PNG, maskable, apple-touch and favicon.ico icons from public/icon.svg.
 * Usage: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('\n[generate-icons] Missing dependency: sharp');
  console.error('Run: npm install --save-dev sharp');
  process.exit(1);
}

const ROOT = process.cwd();
const srcSvg = path.join(ROOT, 'public', 'icon.svg');
const outDir = path.join(ROOT, 'public', 'icons');
const sizes = [144, 192, 256, 384, 512];
const BRAND = '#4f46e5';

// Full-bleed variant: the OS applies its own mask (Android adaptive icons, iOS rounded corners),
// so the background must reach every edge and the glyph must stay inside the 80% safe zone.
const fullBleedSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND}"/>
  <g transform="translate(142 142) scale(9.5)" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </g>
</svg>`);

async function png(svg, size, file){
  const out = path.join(outDir, file);
  await sharp(svg, { density: 512 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out);
  console.log('✓', size, '->', out);
  return out;
}

// ICO container holding PNG-encoded images (supported by every modern browser).
async function ico(svg, icoSizes, out){
  const images = await Promise.all(icoSizes.map(size => sharp(svg, { density: 512 }).resize(size, size).png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((image, i) => {
    const size = icoSizes[i], at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at); header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(image.length, at + 8); header.writeUInt32LE(offset, at + 12);
    offset += image.length;
  });
  fs.writeFileSync(out, Buffer.concat([header, ...images]));
  console.log('✓ ico', icoSizes.join('/'), '->', out);
}

async function run(){
  console.log('[generate-icons] Starting');
  if(!fs.existsSync(srcSvg)){
    console.error('[generate-icons] Source SVG not found:', srcSvg);
    process.exit(1);
  }
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const svg = fs.readFileSync(srcSvg);
  for(const size of sizes) await png(svg, size, `icon-${size}.png`);
  for(const size of [192, 512]) await png(fullBleedSvg, size, `icon-maskable-${size}.png`);
  await png(fullBleedSvg, 180, 'apple-touch-icon.png');
  await ico(svg, [16, 32, 48], path.join(ROOT, 'public', 'favicon.ico'));
  console.log('[generate-icons] Done');
}

run().catch(e=>{ console.error('[generate-icons] Failed:', e); process.exit(1); });
