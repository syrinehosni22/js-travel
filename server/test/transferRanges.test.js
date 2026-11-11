import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTransferQuotes } from '../src/lib/pricing.js';

const vehicles = [
  { key: 'sedan', label: 'Berline', minPassengers: 1, maxPassengers: 4, maxLuggage: 4 },
  { key: 'vip', label: 'VIP', minPassengers: 1, maxPassengers: 4, maxLuggage: 4, onRequest: true },
  { key: 'minivan', label: 'Minivan', minPassengers: 5, maxPassengers: 8, maxLuggage: 8 },
  { key: 'minibus', label: 'Minibus', minPassengers: 9, maxPassengers: 20, maxLuggage: 20 },
];
const grid = ['sedan', 'minivan', 'minibus', 'vip'].map((v, i) => ({ fromZone: 'a', toZone: 'b', vehicle: v, price: 40 + i * 20 }));
const keys = (adult) => computeTransferQuotes({ grid, vehicles }, { fromZone: 'a', toZone: 'b', passengers: { adult } }).map((q) => q.vehicle);

test('1 à 4 passagers : berline, et VIP sur demande', () => {
  assert.deepEqual(keys(1), ['sedan', 'vip']);
  assert.deepEqual(keys(4), ['sedan', 'vip']);
  const vip = computeTransferQuotes({ grid, vehicles }, { fromZone: 'a', toZone: 'b', passengers: { adult: 2 } }).find((q) => q.vehicle === 'vip');
  assert.equal(vip.onRequest, true);
  assert.equal(vip.totalEur, null);
});
test('5 à 8 passagers : minivan uniquement', () => { assert.deepEqual(keys(5), ['minivan']); assert.deepEqual(keys(8), ['minivan']); });
test('plus de 8 passagers : minibus', () => { assert.deepEqual(keys(9), ['minibus']); assert.deepEqual(keys(15), ['minibus']); });
