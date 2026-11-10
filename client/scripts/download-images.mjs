/**
 * Copie les photos de la photothèque (src/images.js) sur votre serveur,
 * dans public/images/<clé>-<largeur>.jpg, pour ne plus dépendre du CDN Unsplash.
 *
 *   node scripts/download-images.mjs
 *   VITE_LOCAL_IMAGES=1 npm run build
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHOTOS, WIDTHS } from '../src/images.js';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/images');
await fs.mkdir(out, { recursive: true });

for (const [key, p] of Object.entries(PHOTOS)) {
  for (const w of WIDTHS) {
    const file = path.join(out, `${key}-${w}.jpg`);
    try { await fs.access(file); continue; } catch {}
    const url = `https://images.unsplash.com/${p.id}?fm=jpg&fit=crop&q=78&w=${w}`;
    const res = await fetch(url);
    if (!res.ok) { console.error(`✗ ${key} ${w}px : HTTP ${res.status}`); continue; }
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
    console.log(`✓ ${key}-${w}.jpg`);
  }
}
console.log(`\nPhotos enregistrées dans ${out}. Crédits : voir IMAGES.md`);
