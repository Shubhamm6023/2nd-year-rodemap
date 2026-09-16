/**
 * CodePath icon generator (zero dependencies).
 *
 *   node tools/make-icons.mjs
 *
 * Web / PWA outputs go to icons/ and Android launcher icons go to the
 * android/res mipmap folders. Everything is drawn from signed distance fields, so
 * the art is identical at every size:
 *
 *   gradient rounded tile + white "< >" code chevrons + amber play button
 *
 * Adaptive icons (API 26+) get a separate full-bleed gradient background and a
 * glyph-only foreground, so the launcher can mask them into any shape.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIR = join(ROOT, 'icons');
const ANDROID_RES = join(ROOT, 'android', 'res');

/* ------------------------------------------------------------------ colors */

const STOPS = [
  [0.0, [0x4f, 0x46, 0xe5]], // indigo
  [0.55, [0x7c, 0x3a, 0xed]], // violet
  [1.0, [0xc0, 0x26, 0xd3]], // fuchsia
];
const WHITE = [0xff, 0xff, 0xff];
const AMBER = [0xfb, 0xbf, 0x24];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function gradientAt(t) {
  t = clamp(t, 0, 1);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [t0, c0] = STOPS[i];
    const [t1, c1] = STOPS[i + 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
    }
  }
  return STOPS[STOPS.length - 1][1].slice();
}

/* ------------------------------------------------------------ SDF helpers */
// All distances are in pixels of the target image.

function roundRectSDF(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - (hw - r);
  const dy = Math.abs(y - cy) - (hh - r);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - r;
}

function circleSDF(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r;
}

function segmentSDF(x, y, a, b, halfWidth) {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const apx = x - a[0];
  const apy = y - a[1];
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : clamp((apx * abx + apy * aby) / len2, 0, 1);
  return Math.hypot(apx - abx * t, apy - aby * t) - halfWidth;
}

function centroid(pts) {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

/** SDF of a convex polygon (negative inside) as the max of its half planes. */
function polygonSDF(x, y, pts, angleInflation) {
  let m = -Infinity;
  const [cx, cy] = centroid(pts);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len = Math.hypot(ex, ey) || 1;
    let nx = ey / len;
    let ny = -ex / len;
    // make the normal point away from the centroid
    if ((cx - a[0]) * nx + (cy - a[1]) * ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    m = Math.max(m, (x - a[0]) * nx + (y - a[1]) * ny);
  }
  return m - angleInflation;
}

/** Inradius of a triangle (radius of the largest inscribed circle). */
function inradius(tri) {
  const [a, b, c] = tri;
  const sa = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const sb = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const sc = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const area = Math.abs(
    (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]),
  ) / 2;
  return area / ((sa + sb + sc) / 2);
}

/** Anti-aliased coverage from a signed distance (1px wide ramp). */
const coverage = (d) => clamp(0.5 - d, 0, 1);

/* -------------------------------------------------------------- the tile */

const CHEVRON_STOCK = 0.066; // stroke width / canvas, matches icons/icon.svg
const TRI_RADIUS = 0.02; // corner rounding of the play button

/**
 * @param {number} size    output size in pixels
 * @param {object} [opts]
 * @param {'rounded'|'square'|'circle'} [opts.shape]  silhouette of the tile
 * @param {boolean} [opts.background]  draw the gradient tile
 * @param {boolean} [opts.glyph]       draw the chevrons + play button
 */
function paintIcon(size, opts = {}) {
  const { shape = 'rounded', background = true, glyph = true } = opts;
  const px = new Uint8ClampedArray(size * size * 4); // straight RGBA, start clear
  const S = size;
  const rectRadius = shape === 'rounded' ? 0.22 * S : 0;
  const chevron = (CHEVRON_STOCK * S) / 2;

  /** Coverage of the tile silhouette (rounded rect, or clipped to a circle). */
  const tileCoverage = (x, y) => {
    const rect = coverage(roundRectSDF(x, y, S / 2, S / 2, S / 2, S / 2, rectRadius));
    if (rect <= 0) return 0;
    if (shape !== 'circle') return rect;
    return Math.min(rect, coverage(circleSDF(x, y, S / 2, S / 2, S / 2)));
  };

  const left = [
    [0.4 * S, 0.27 * S],
    [0.256 * S, 0.5 * S],
    [0.4 * S, 0.73 * S],
  ];
  const right = [
    [0.6 * S, 0.27 * S],
    [0.744 * S, 0.5 * S],
    [0.6 * S, 0.73 * S],
  ];

  const tri = [
    [0.455 * S, 0.375 * S],
    [0.455 * S, 0.625 * S],
    [0.576 * S, 0.5 * S],
  ];
  // Shrink the triangle so that inflating it by TRI_RADIUS * S reproduces the
  // original outline but with rounded corners (same trick the SVG uses).
  const inflate = TRI_RADIUS * S;
  const [tcx, tcy] = centroid(tri);
  const k = clamp(1 - inflate / Math.max(inradius(tri), 1e-6), 0.05, 1);
  const triShrunk = tri.map(([x, y]) => [tcx + (x - tcx) * k, tcy + (y - tcy) * k]);

  const layers = [];

  if (background) {
    // gradient tile
    layers.push((x, y) => {
      const a = tileCoverage(x, y);
      if (a <= 0) return null;
      const c = gradientAt((x + y) / (2 * S));
      return [c[0], c[1], c[2], a];
    });
    // soft highlight in the top-left corner
    layers.push((x, y) => {
      const a = tileCoverage(x, y);
      if (a <= 0) return null;
      const dist = Math.hypot(x - 0.28 * S, y - 0.2 * S);
      const glow = clamp(1 - dist / (0.85 * S), 0, 1) ** 2 * 0.26;
      if (glow <= 0) return null;
      return [255, 255, 255, glow * a];
    });
  }

  if (glyph) {
    // left chevron
    layers.push((x, y) => {
      const d = Math.min(
        segmentSDF(x, y, left[0], left[1], chevron),
        segmentSDF(x, y, left[1], left[2], chevron),
      );
      const a = coverage(d) * (background ? 1 : 1);
      return a <= 0 ? null : [WHITE[0], WHITE[1], WHITE[2], a];
    });
    // right chevron
    layers.push((x, y) => {
      const d = Math.min(
        segmentSDF(x, y, right[0], right[1], chevron),
        segmentSDF(x, y, right[1], right[2], chevron),
      );
      const a = coverage(d);
      return a <= 0 ? null : [WHITE[0], WHITE[1], WHITE[2], a];
    });
    // play button
    layers.push((x, y) => {
      const a = coverage(polygonSDF(x, y, triShrunk, inflate));
      return a <= 0 ? null : [AMBER[0], AMBER[1], AMBER[2], a];
    });
  }

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0; // straight (non-premultiplied) accumulator
      for (const layer of layers) {
        const src = layer(x + 0.5, y + 0.5);
        if (!src) continue;
        const sa = src[3];
        if (sa <= 0) continue;
        const na = sa + a * (1 - sa);
        if (na <= 0) continue;
        r = (src[0] * sa + r * a * (1 - sa)) / na;
        g = (src[1] * sa + g * a * (1 - sa)) / na;
        b = (src[2] * sa + b * a * (1 - sa)) / na;
        a = na;
      }
      const i = (y * S + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = Math.round(a * 255);
    }
  }
  return px;
}

/* ------------------------------------------------------------ PNG encoder */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolor + alpha
  // 10..12 = deflate / adaptive filtering / no interlace (all zero)

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ----------------------------------------------------------------- the SVG */

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="CodePath">
  <title>CodePath</title>
  <defs>
    <linearGradient id="cp-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f46e5"/>
      <stop offset="0.55" stop-color="#7c3aed"/>
      <stop offset="1" stop-color="#c026d3"/>
    </linearGradient>
    <radialGradient id="cp-glow" cx="0.28" cy="0.2" r="0.85">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="113" fill="url(#cp-grad)"/>
  <rect width="512" height="512" rx="113" fill="url(#cp-glow)"/>
  <g fill="none" stroke="#ffffff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round">
    <path d="M205 138 L131 256 L205 374"/>
    <path d="M307 138 L381 256 L307 374"/>
  </g>
  <path d="M233 192 L233 320 L295 256 Z" fill="#fbbf24" stroke="#fbbf24" stroke-width="20" stroke-linejoin="round"/>
</svg>
`;

/* ------------------------------------------------------------ write files */

function writePNG(file, size, opts) {
  const png = encodePNG(paintIcon(size, opts), size);
  writeFileSync(file, png);
  return png.length;
}

console.log('web / PWA icons');
const WEB_TARGETS = [
  { file: 'icon-512.png', size: 512, opts: { shape: 'rounded' } },
  { file: 'icon-maskable-512.png', size: 512, opts: { shape: 'square' } },
  { file: 'icon-384.png', size: 384, opts: { shape: 'rounded' } },
  { file: 'icon-192.png', size: 192, opts: { shape: 'rounded' } },
  { file: 'apple-touch-icon.png', size: 180, opts: { shape: 'square' } },
  { file: 'favicon-32.png', size: 32, opts: { shape: 'rounded' } },
];
mkdirSync(WEB_DIR, { recursive: true });
for (const { file, size, opts } of WEB_TARGETS) {
  const bytes = writePNG(join(WEB_DIR, file), size, opts);
  console.log(`  icons/${file.padEnd(26)} ${size}x${size}  ${(bytes / 1024).toFixed(1)} KB`);
}
writeFileSync(join(WEB_DIR, 'icon.svg'), SVG);
console.log('  icons/icon.svg                vector');

/* Android launcher icons.
 *   legacy  : 48dp tile
 *   adaptive: 108dp layers (background + glyph-only foreground)            */
const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

console.log('\nandroid launcher icons');
for (const [density, scale] of DENSITIES) {
  const dir = join(ANDROID_RES, `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });

  const legacy = 48 * scale;
  const adaptive = 108 * scale;

  const square = writePNG(join(dir, 'ic_launcher.png'), legacy, { shape: 'rounded' });
  writePNG(join(dir, 'ic_launcher_round.png'), legacy, { shape: 'circle' });
  const bg = writePNG(join(dir, 'ic_launcher_background.png'), adaptive, { shape: 'square', glyph: false });
  const fg = writePNG(join(dir, 'ic_launcher_foreground.png'), adaptive, {
    shape: 'square',
    background: false,
  });
  console.log(
    `  mipmap-${density.padEnd(8)} ic_launcher ${legacy}px (${(square / 1024).toFixed(1)} KB)` +
      ` · round · background ${adaptive}px (${(bg / 1024).toFixed(1)} KB)` +
      ` · foreground (${(fg / 1024).toFixed(1)} KB)`,
  );
}
console.log('\nDone.');
