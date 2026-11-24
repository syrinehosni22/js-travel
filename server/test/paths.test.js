import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('segments d’adresse : fichiers client et serveur identiques', () => {
  const a = readFileSync(new URL('../src/lib/paths.js', import.meta.url), 'utf8');
  const b = readFileSync(new URL('../../client/src/lib/paths.js', import.meta.url), 'utf8');
  assert.equal(a, b);
});

test('sitemap : chaque langue avec ses propres segments', async () => {
  const { PATHS } = await import('../src/lib/paths.js');
  assert.equal(PATHS.fr.transfers, 'transferts');
  assert.equal(PATHS.de.contact, 'kontakt');
  assert.equal(PATHS.it.excursions, 'escursioni');
});
