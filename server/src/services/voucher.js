import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Emblème blanc du logo (copié depuis client/public/brand)
const EMBLEM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../client/public/brand/emblem-white.png');
import { formatMoney } from '../lib/pricing.js';
import { t } from './i18n.js';
import { pdfText } from './text.js';

/** Bon PDF (réservation ou transfert) envoyé au client — §4.4 et §5.3. Renvoie un Buffer. */
export function voucherPdf(booking, { contact = {} } = {}) {
  const lang = booking.lang || 'en';
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  // Les polices intégrées du PDF ne savent pas afficher tous les caractères (flèches, caractères invisibles…)
  const rawText = doc.text.bind(doc);
  doc.text = (str, ...rest) => rawText(typeof str === 'string' ? pdfText(str) : str, ...rest);
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const green = '#14213D';
  const gold = '#C9A227';
  doc.rect(0, 0, doc.page.width, 96).fill(green);
  doc.rect(0, 96, doc.page.width, 3).fill(gold);
  if (fs.existsSync(EMBLEM)) doc.image(EMBLEM, doc.page.width - 50 - 64, 16, { width: 64 });
  doc.fillColor('#FFFFFF').font('Times-Bold').fontSize(24).text('JS Travel', 50, 16);
  doc.font('Helvetica').fontSize(8).fillColor(gold).text('TUNISIA', 52, 44, { characterSpacing: 3.2 });
  doc.fillColor('#FFFFFF').fontSize(12).text(`${t(lang, 'voucher')} · ${t(lang, 'ref')} : ${booking.ref}`, 50, 66);
  doc.font('Helvetica');
  doc.fillColor('#14213D').moveDown(3);

  doc.y = 120;
  doc.fontSize(12).text(`${booking.customer.name}`, { continued: false });
  if (booking.customer.hotel) doc.text(`${booking.customer.hotel}${booking.customer.room ? ' · ' + booking.customer.room : ''}`);
  doc.text(booking.customer.phone || '');
  doc.moveDown();

  for (const it of booking.items) {
    if (it.status === 'cancelled') continue;
    doc.fontSize(15).fillColor(green).text(it.title || '', { underline: false });
    doc.fontSize(11).fillColor('#14213D');
    const p = it.participants || {};
    doc.text(`${t(lang, 'date')} : ${it.date}${it.time ? ' · ' + it.time : ''}`);
    const n = (k, one, many) => `${k} ${t(lang, k === 1 ? one : many)}`;
    doc.text(`${t(lang, 'people')} : ${n(p.adult || 0, 'adult', 'adults')}${p.child ? `, ${n(p.child, 'child', 'children')}` : ''}${p.infant ? `, ${n(p.infant, 'infant', 'infants')}` : ''}`);
    const extras = (it.lines || []).filter((l) => l.key === 'option');
    if (extras.length) doc.text(`${t(lang, 'extras')} : ${extras.map((l) => `${l.label}${l.qty > 1 ? ` × ${l.qty}` : ''}`).join(', ')}`);
    if (it.type === 'transfer' && it.transfer) {
      doc.text(`${t(lang, 'pickup')} : ${it.transfer.from}${it.transfer.flightNumber ? ` · ${t(lang, 'flight')} ${it.transfer.flightNumber}` : ''}`);
      doc.text(`${t(lang, 'dropoff')} : ${it.transfer.to}`);
    } else if (it.zone) doc.text(`${t(lang, 'pickup')} : ${it.zone}`);
    doc.text(formatMoney(it.totalEur, 'EUR', lang));
    doc.moveDown();
  }

  doc.moveDown();
  doc.fontSize(16).fillColor(green).text(`${t(lang, 'total')} : ${formatMoney(booking.totalEur, 'EUR', lang)} ${t(lang, 'ttc')}`);
  if (booking.currency !== 'EUR') doc.fontSize(11).fillColor('#4B5B54').text(`≈ ${formatMoney(booking.totalDisplay, booking.currency, lang)}`);
  doc.fontSize(11).fillColor('#4B5B54').text(t(lang, 'payOnSite'));
  doc.moveDown(2);
  doc.fontSize(10).text([contact.phone, contact.whatsapp && 'WhatsApp ' + contact.whatsapp, contact.email].filter(Boolean).join(' · '));
  doc.end();
  return done;
}
