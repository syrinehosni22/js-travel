import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { commissionRows } from '../src/lib/commission.js';
import { commissionWorkbook } from '../src/services/commission.js';

const bookings = [
  { ref: 'B2', status: 'completed', firstServiceDate: '2026-11-12', customer: { name: 'Tom' }, items: [{ title: 'Djerba 3 jours' }], totalEur: 450 },
  { ref: 'B1', status: 'paid_on_site', firstServiceDate: '2026-11-03', customer: { name: 'Amel' }, items: [{ title: 'Carthage' }, { title: 'Transfert', status: 'cancelled' }], totalEur: 200, collectedAmount: 180 },
  { ref: 'B3', status: 'confirmed', firstServiceDate: '2026-11-05', customer: { name: 'Non réglée' }, totalEur: 999 },
];

test('commission : seulement les réservations réglées, base = montant encaissé sinon total', () => {
  const r = commissionRows(bookings, 10);
  assert.deepEqual(r.rows.map((x) => x.ref), ['B1', 'B2']);          // triées par date, B3 exclue
  assert.equal(r.rows[0].base, 180);                                 // montant encaissé
  assert.equal(r.rows[0].items, 'Carthage');                         // ligne annulée ignorée
  assert.equal(r.total, 630);
  assert.equal(r.commission, 63);
  assert.equal(commissionRows(bookings, 12.5).commission, 78.75);
});

test('commission : fichier Excel avec formules et totaux', async () => {
  const data = { name: 'Syrine', from: '2026-11-01', to: '2026-11-30', ...commissionRows(bookings, 10) };
  const buf = await commissionWorkbook(data);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('Commission');
  assert.equal(ws.getCell('A1').value, 'Commission de Syrine');
  assert.equal(ws.getCell('B3').value, 0.1);
  assert.equal(ws.getCell('A7').value, 'B1');
  assert.equal(ws.getCell('F7').value, 180);
  assert.equal(ws.getCell('G7').value.formula, 'F7*$B$3');
  assert.equal(ws.getCell('G9').value.formula, 'SUM(G7:G8)');
  assert.equal(ws.getCell('G9').value.result, 63);
});
