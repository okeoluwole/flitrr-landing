/**
 * Builds public/og-image.png from public/og-image.svg at 1200x630.
 *
 * Run once when og-image.svg changes:
 *
 *   node scripts/build-og.js
 *
 * The PNG is committed to the repo (not built at deploy time) so
 * Vercel doesn't need to install sharp at runtime.
 */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'public', 'og-image.svg');
const DEST = path.join(ROOT, 'public', 'og-image.png');

async function build() {
  const svg = fs.readFileSync(SRC);

  await sharp(svg, { density: 192 })
    .resize(1200, 630, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(DEST);

  console.log(`og-image.png built at ${DEST}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
