import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byDisplayOrder } from '../src/lib/order.js';

test('ordre d’affichage : position choisie, puis popularité, puis la plus ancienne', () => {
  const list = [
    { id: 'sans-position-populaire', popularity: 50, createdAt: '2026-01-02' },
    { id: 'pos2', position: 2 },
    { id: 'sans-position-ancienne', popularity: 0, createdAt: '2026-01-01' },
    { id: 'pos1', position: 1, popularity: 0 },
    { id: 'sans-position-recente', popularity: 0, createdAt: '2026-03-01' },
  ];
  assert.deepEqual([...list].sort(byDisplayOrder).map((x) => x.id),
    ['pos1', 'pos2', 'sans-position-populaire', 'sans-position-ancienne', 'sans-position-recente']);
});
