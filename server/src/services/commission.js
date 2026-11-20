import ExcelJS from 'exceljs';

const STATUS_FR = { paid_on_site: 'Réglée sur place', completed: 'Terminée' };

/** Fichier Excel de la commission (formules : le fichier se recalcule si on modifie un montant ou le taux) */
export async function commissionWorkbook({ name, percent, from, to, rows }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JS Travel Tunisia';
  const ws = wb.addWorksheet('Commission', { views: [{ state: 'frozen', ySplit: 6 }] });
  ws.columns = [{ width: 30 }, { width: 15 }, { width: 24 }, { width: 40 }, { width: 18 }, { width: 18 }, { width: 16 }];
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  ws.addRow([`Commission de ${name}`]).font = { bold: true, size: 14 };
  ws.addRow(['Période', `du ${from} au ${to}`]);
  const rateRow = ws.addRow(['Taux de commission', percent / 100]);
  rateRow.getCell(2).numFmt = '0.0%';
  ws.addRow(['Réservations prises en compte', 'réglées sur place ou terminées — base : montant encaissé, sinon total']);
  ws.addRow([]);
  const head = ws.addRow(['Réservation', 'Date de service', 'Client', 'Prestations', 'Statut', 'Montant réglé (€)', 'Commission (€)']);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14213D' } }; c.alignment = { vertical: 'middle', wrapText: true }; });
  const first = head.number + 1;
  for (const r of rows) {
    const row = ws.addRow([r.ref, r.date, r.customer, r.items, STATUS_FR[r.status] || r.status, r.base, null]);
    row.getCell(7).value = { formula: `F${row.number}*$B$${rateRow.number}`, result: r.commission };
    row.getCell(4).alignment = { wrapText: true, vertical: 'top' };
  }
  const last = ws.lastRow.number;
  const tot = ws.addRow(['Total', '', '', `${rows.length} réservation(s)`, '', null, null]);
  const sum = (col) => (rows.length ? { formula: `SUM(${col}${first}:${col}${last})`, result: rows.reduce((s, r) => s + (col === 'F' ? r.base : r.commission), 0) } : 0);
  tot.getCell(6).value = sum('F');
  tot.getCell(7).value = sum('G');
  tot.font = { bold: true };
  tot.eachCell((c) => { c.border = { top: { style: 'thin' } }; });
  for (let i = first; i <= tot.number; i++) for (const c of [6, 7]) ws.getRow(i).getCell(c).numFmt = '#,##0.00 €';
  return wb.xlsx.writeBuffer();
}
