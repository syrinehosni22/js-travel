import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingSchema } from '../src/routes/public.js';

const base = {
  items: [{ type: 'excursion', excursion: 'e1', date: '2026-12-20', participants: { adult: 2 } }],
  customer: { name: 'Amel Ben', email: 'a@b.tn', phone: '+21600000000', nationality: 'TN', city: 'Sousse', hotel: 'Marhaba' },
  consent: { terms: true, cancellation: true },
};
const fails = (b) => !bookingSchema.safeParse(b).success;

test('réservation : champs obligatoires refusés s’ils manquent', () => {
  assert.equal(bookingSchema.safeParse(base).success, true);
  for (const k of ['name', 'email', 'phone', 'nationality', 'city', 'hotel']) {
    const { [k]: _, ...customer } = base.customer;
    assert.equal(fails({ ...base, customer }), true, k);
  }
  assert.equal(fails({ ...base, customer: { ...base.customer, hotel: '   ' } }), true, 'hôtel vide');
  assert.equal(fails({ ...base, consent: { terms: true, cancellation: false } }), true, 'conditions');
  // transfert seul : ni ville ni hôtel exigés
  const transferOnly = { ...base, items: [{ type: 'transfer', participants: { adult: 2 }, transfer: { datetime: '2026-12-20T10:00', vehicle: 'sedan' } }], customer: { ...base.customer, city: undefined, hotel: undefined } };
  assert.equal(bookingSchema.safeParse(transferOnly).success, true);
});
