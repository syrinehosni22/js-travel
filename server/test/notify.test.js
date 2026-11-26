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

test('alerte WhatsApp Cloud : message libre, ou modèle approuvé avec le texte sur une ligne', async () => {
  const { whatsappPayload } = await import('../src/services/notify.js');
  assert.deepEqual(whatsappPayload('21624500358', 'a\nb'), { messaging_product: 'whatsapp', to: '21624500358', type: 'text', text: { body: 'a\nb' } });
  const p = whatsappPayload('21624500358', 'Nouvelle réservation JS-1\n\nAmel   Ben\nTotal : 190 €', { template: 'nouvelle_reservation', templateLang: 'fr' });
  assert.equal(p.type, 'template');
  assert.equal(p.template.name, 'nouvelle_reservation');
  assert.deepEqual(p.template.language, { code: 'fr' });
  assert.equal(p.template.components[0].parameters[0].text, 'Nouvelle réservation JS-1 · Amel Ben · Total : 190 €');
});

test('numéros WhatsApp : format international, numéros tunisiens sans indicatif', async () => {
  const { intlPhone } = await import('../src/services/notify.js');
  for (const x of ['+216 24 500 358', '0021624500358', '24 500 358', '216-24-500-358']) assert.equal(intlPhone(x), '21624500358', x);
  assert.equal(intlPhone('+33 6 12 34 56 78'), '33612345678');
  assert.equal(intlPhone('123'), null);
  assert.equal(intlPhone(''), null);
});

test('e-mails : version texte et adresse du site suspecte', async () => {
  const { htmlToText, siteUrlProblem } = await import('../src/services/notify.js');
  const txt = htmlToText('<h1>Réservation confirmée</h1><p>Bonjour Amel,</p><table><tr><td>Carthage</td><td>190,00 €</td></tr></table><p><a href="https://jstraveltrip.com/fr/booking/X">Gérer ma réservation</a></p><p>A &amp; B</p>');
  for (const part of ['Réservation confirmée', 'Bonjour Amel,', 'Carthage 190,00 €', 'Gérer ma réservation : https://jstraveltrip.com/fr/booking/X', 'A & B']) assert.ok(txt.includes(part), `${part}\n---\n${txt}`);
  assert.ok(!/<[a-z]/i.test(txt));
  assert.equal(siteUrlProblem('https://jstraveltrip.com'), null);
  assert.equal(siteUrlProblem('http://163.245.217.83'), 'ip');
  assert.equal(siteUrlProblem('http://localhost:5173'), 'localhost');
  assert.equal(siteUrlProblem('http://jstraveltrip.com'), 'http');
});

test('chauffeur dans la confirmation et la feuille de route', async () => {
  const { driverLine, driverOf } = await import('../src/services/drivers.js');
  const { bookingText, roadmapText } = await import('../src/services/notify.js');
  const ali = { _id: 'd1', name: 'Ali', phone: '+216 20 111 222', vehicle: { label: 'Toyota Hiace', plate: '123 TU 4567' } };
  assert.equal(driverLine(ali, 'fr'), 'Chauffeur : Ali · +216 20 111 222 · Toyota Hiace (123 TU 4567)');
  assert.equal(driverLine(ali, 'en'), 'Driver : Ali · +216 20 111 222 · Toyota Hiace (123 TU 4567)');
  assert.equal(driverOf({ driver: 'd1' }, new Map([['d1', ali]])).name, 'Ali');
  assert.equal(driverOf({ driver: ali }).name, 'Ali');
  assert.equal(driverOf({}), null);
  const txt = bookingText({ ref: 'X', totalEur: 50, customer: { name: 'Amel' }, items: [{ title: 'Carthage', date: '2026-12-01', totalEur: 50, driver: ali }] });
  assert.ok(txt.includes('Chauffeur : Ali · +216 20 111 222'), txt);
  const rm = roadmapText(ali, '2026-12-01', [{ time: '08:00', title: 'Carthage', customer: 'Amel', pax: 3, hotel: 'Marhaba', phone: '+216 55' }]);
  assert.ok(rm.startsWith('Feuille de route 2026-12-01 — Ali'), rm);
  assert.ok(rm.includes('08:00 · Carthage · Amel (3 pers.) · Marhaba · +216 55'), rm);
});
