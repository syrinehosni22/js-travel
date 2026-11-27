import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyItemPrice, applyTotal } from '../src/lib/adjust.js';

test('remise en % puis prix manuel puis retour au prix d’origine', () => {
  const it = { totalEur: 200, lines: [{ key: 'adult', amount: 200 }] };
  let r = applyItemPrice(it, { mode: 'percent', value: 10 });
  assert.deepEqual([r.before, r.after, it.totalEur, it.basePriceEur], [200, 180, 180, 200]);
  assert.deepEqual(it.lines.at(-1), { key: 'adminDiscount', label: 'Remise', rate: 0.1, amount: -20 });
  // Nouvelle remise : toujours calculée sur le prix d'origine, pas cumulée
  r = applyItemPrice(it, { mode: 'percent', value: 25, reason: 'Client fidèle' });
  assert.equal(it.totalEur, 150);
  assert.equal(it.lines.filter((l) => l.key === 'adminDiscount').length, 1);
  assert.equal(it.lines.at(-1).label, 'Client fidèle');
  assert.equal(applyTotal(350, r), 320);   // 350 - (180 - 150)
  r = applyItemPrice(it, { mode: 'amount', value: 210 });
  assert.equal(it.totalEur, 210);
  assert.equal(it.lines.at(-1).amount, 10);          // supplément
  assert.equal(it.lines.at(-1).label, 'Ajustement');
  applyItemPrice(it, { mode: 'reset' });
  assert.equal(it.totalEur, 200);
  assert.equal(it.basePriceEur, undefined);
  assert.equal(it.lines.some((l) => l.key === 'adminDiscount'), false);
  // 0 % = prix d'origine ; bornes
  applyItemPrice(it, { mode: 'percent', value: 0 });
  assert.equal(it.totalEur, 200);
  applyItemPrice(it, { mode: 'percent', value: 150 });
  assert.equal(it.totalEur, 0);
});
