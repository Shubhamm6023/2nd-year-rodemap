/**
 * Asset integrity check:  node tools/check-assets.mjs
 *
 * Verifies that every local file referenced from index.html, app.webmanifest
 * and the service worker's precache list actually exists on disk.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
let checked = 0;

function check(ref, source) {
  if (!ref) return;
  if (/^(https?:|mailto:|data:|#|\/\/)/.test(ref)) return;
  const clean = ref.split('?')[0].split('#')[0];
  if (!clean || clean === './' || clean === '.') return;
  checked++;
  if (!existsSync(join(ROOT, clean))) problems.push(`${source} -> missing file: ${clean}`);
}

/* index.html: src / href / srcset attributes */
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
for (const match of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) check(match[1], 'index.html');
for (const match of html.matchAll(/<script[^>]*src="([^"]+)"/g)) check(match[1], 'index.html (script)');

/* every inline <script> body must at least parse */
let inline = 0;
for (const match of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
  if (!match[1].trim()) continue;
  inline++;
  try {
    new Function(match[1]);
  } catch (err) {
    problems.push(`index.html inline script ${inline} has a syntax error: ${err.message}`);
  }
}

/* manifest icons */
const manifest = JSON.parse(readFileSync(join(ROOT, 'app.webmanifest'), 'utf8'));
(manifest.icons || []).forEach((icon) => check(icon.src, 'app.webmanifest icons'));
(manifest.shortcuts || []).forEach((sc) => (sc.icons || []).forEach((icon) => check(icon.src, 'app.webmanifest shortcut')));
if (!manifest.start_url) problems.push('app.webmanifest is missing start_url');
if (!manifest.icons || manifest.icons.length < 2) problems.push('app.webmanifest needs at least 2 icons');
if (!(manifest.icons || []).some((i) => String(i.purpose || '').includes('maskable'))) {
  problems.push('app.webmanifest needs a maskable icon');
}
if (!(manifest.icons || []).some((i) => i.sizes === '192x192')) {
  problems.push('app.webmanifest needs a 192x192 icon (installability requirement)');
}

/* service worker precache list */
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const assetsBlock = sw.match(/var ASSETS = \[([\s\S]*?)\];/);
if (!assetsBlock) {
  problems.push('sw.js: could not find the ASSETS precache list');
} else {
  for (const match of assetsBlock[1].matchAll(/'([^']+)'/g)) check(match[1], 'sw.js precache');
}

/* the icons must be real PNGs / SVG, not empty placeholders */
for (const file of ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png']) {
  const path = join(ROOT, 'icons', file);
  if (!existsSync(path)) continue;
  const buf = readFileSync(path);
  if (buf.length < 500) problems.push(`icons/${file} looks empty (${buf.length} bytes)`);
  if (file.endsWith('.png') && buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    problems.push(`icons/${file} is not a valid PNG`);
  }
  if (file.endsWith('.svg') && !buf.toString('utf8').includes('<svg')) {
    problems.push(`icons/${file} is not valid SVG`);
  }
}

console.log(`Checked ${checked} local asset references.`);
if (problems.length) {
  console.error('\nFAILED:');
  problems.forEach((p) => console.error(`  x ${p}`));
  process.exit(1);
}
console.log('OK: html, manifest, service worker and icons all resolve.');
