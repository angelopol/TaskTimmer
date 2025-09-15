#!/usr/bin/env node
/**
 * Generate PNG and maskable icons from base SVG.
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
const srcSvg = path.join(ROOT, 'public', 'icon-clock-pixel.svg');
const outDir = path.join(ROOT, 'public', 'icons');
const sizes = [144, 192, 256, 384, 512];

async function buildSizedIcon(sharpBuffer, size){
  const out = path.join(outDir, `icon-${size}.png`);
  await sharpBuffer
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('✓', size, '->', out);
}

async function buildMaskable(svgBuffer, size){
  const out = path.join(outDir, `icon-maskable-${size}.png`);
  // Increase padding to ~20% to avoid clipping on aggressive mask shapes
  const pad = Math.round(size * 0.20);
  await sharp({ create: { width:size, height:size, channels:4, background:'#111827' } })
    .composite([{ input: svgBuffer, top: pad, left: pad }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('✓ maskable', size, '->', out);
}

async function run(){
  console.log('[generate-icons] Starting');
  if(!fs.existsSync(srcSvg)){
    console.error('[generate-icons] Source SVG not found:', srcSvg);
    process.exit(1);
  }
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const svgBuffer = fs.readFileSync(srcSvg);
  const sharpBase = sharp(svgBuffer, { density: 480 });

  for(const size of sizes){
    await buildSizedIcon(sharpBase.clone(), size);
  }
  for(const size of [192, 512]){
    await buildMaskable(svgBuffer, size);
  }
  console.log('[generate-icons] Done');
}

run().catch(e=>{ console.error('[generate-icons] Failed:', e); process.exit(1); });
