import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingText } from '../src/services/notify.js';

test('texte WhatsApp d’une réservation : client, hôtel, excursions, options, total', () => {
  const txt = bookingText({
    ref: 'JS-2611-AB12', totalEur: 190,
    customer: { name: 'Amel Ben', phone: '+216 20 000 000', nationality: 'TN', hotel: 'Marhaba', city: 'Nabeul', room: '214', notes: 'Végétarien' },
    items: [{ title: 'Carthage & Sidi Bou Saïd', date: '2026-12-20', time: '08:00', participants: { adult: 2, child: 1 }, totalEur: 190,
      lines: [{ key: 'guide', amount: 30 }, { key: 'cityTransfer', label: 'Nabeul', amount: 40 }, { key: 'option', label: 'Déjeuner', amount: 30 }] }],
  });
  for (const part of ['Nouvelle réservation JS-2611-AB12', 'Amel Ben · +216 20 000 000 · TN', 'Hôtel : Marhaba, Nabeul (ch. 214)', 'Carthage & Sidi Bou Saïd — 2026-12-20 08:00 — 2 ad. + 1 enf.', 'guide, déplacement depuis Nabeul, Déjeuner', 'Total : 190,00', 'Remarques : Végétarien']) {
    assert.ok(txt.includes(part), `${part}\n---\n${txt}`);
  }
});
