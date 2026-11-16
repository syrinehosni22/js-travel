import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeExcursionPrice, computeTransferQuotes, seasonFor, groupTable, minimumWarnings, discountRate, capacityOf, countTable, priceForCount, fromPrice } from '../src/lib/pricing.js';

const carthage = {
  pricing: {
    mode: 'minimum',
    seasons: { low: { minimum: 200, adult: 50 }, mid: { minimum: 220, adult: 55 }, high: { minimum: 240, adult: 60 } },
    childDiscount: 0.5, infantDiscount: 1, maxGroup: 8,
    zones: [{ key: 'sousse', fee: 0 }, { key: 'hammamet', label: 'Hammamet', fee: 10 }],
    options: [{ key: 'lunch', label: 'Déjeuner', price: 15, per: 'person' }],
  },
};
const calendar = { seasons: [{ name: 'high', from: '07-01', to: '08-31' }, { name: 'low', from: '11-01', to: '03-15' }] };

test('saisons, y compris une période qui chevauche le nouvel an', () => {
  assert.equal(seasonFor('2026-08-14', calendar), 'high');
  assert.equal(seasonFor('2027-01-10', calendar), 'low');
  assert.equal(seasonFor('2026-05-10', calendar), 'mid');
});

test('§3.4 — exemple Carthage : 319,50 €', () => {
  const r = computeExcursionPrice(carthage,
    { date: '2026-08-14', participants: { adult: 4, child: 1 }, zone: 'hammamet', options: ['lunch'] },
    { calendar, discount: { rate: 0.1, source: 'promo' } });
  assert.equal(r.totalEur, 319.5);
  assert.equal(r.threshold, 4);
});

test('§3.2 bis — tableau du minimum garanti', () => {
  const expected = { 1: 240, 2: 120, 3: 80, 4: 60, 5: 60, 8: 60 };
  for (const [n, pp] of Object.entries(expected)) {
    const r = computeExcursionPrice(carthage, { date: '2026-08-14', participants: { adult: +n } }, { calendar });
    assert.equal(r.perPerson, pp, `${n} personnes`);
  }
  const r3 = computeExcursionPrice(carthage, { date: '2026-08-14', participants: { adult: 3 } }, { calendar });
  assert.equal(r3.missing, 1);
});

test('au-delà de la capacité : bascule sur devis', () => {
  const r = computeExcursionPrice(carthage, { participants: { adult: 9 } }, { calendar });
  assert.ok(r.quote && r.overCapacity);
});

test('tableau par taille de groupe et alerte admin', () => {
  assert.equal(groupTable(carthage, 'high').length, 8);
  assert.deepEqual(minimumWarnings(carthage), []);
  const bad = { pricing: { mode: 'minimum', maxGroup: 3, seasons: { mid: { minimum: 240, adult: 60 } } } };
  assert.equal(minimumWarnings(bad).length, 1);
});

test('remises non cumulables : la meilleure s’applique', () => {
  const d = discountRate({ promo: { code: 'X', percent: 10 }, partner: { percent: 15 } });
  assert.equal(d.rate, 0.15);
});

test('transferts : grille par zones, choix du véhicule, nuit et aller-retour', () => {
  const cfg = {
    vehicles: [{ key: 'sedan', label: 'Berline', maxPassengers: 3, maxLuggage: 3 }, { key: 'van', label: 'Minivan', maxPassengers: 7, maxLuggage: 7 }],
    grid: [{ fromZone: 'enfidha', toZone: 'sousse', vehicle: 'sedan', price: 40 }, { fromZone: 'enfidha', toZone: 'sousse', vehicle: 'van', price: 60 }],
    supplements: { nightPercent: 20 },
    returnDiscount: 10,
  };
  const q = computeTransferQuotes(cfg, { fromZone: 'sousse', toZone: 'enfidha', passengers: { adult: 4 }, luggage: 4, datetime: '2026-08-14T23:30' });
  assert.equal(q.length, 1);
  assert.equal(q[0].vehicle, 'van');
  assert.equal(q[0].totalEur, 72);
  const rt = computeTransferQuotes(cfg, { fromZone: 'enfidha', toZone: 'sousse', passengers: { adult: 2 }, datetime: '2026-08-14T12:00', roundTrip: true, returnDatetime: '2026-08-21T12:00' });
  assert.equal(rt[0].totalEur, 40 + 36);
});

/* ---------- Mode « selon le nombre de personnes » ---------- */
const byCount = {
  pricing: { mode: 'per_count', childDiscount: 0.5, infantDiscount: 1, byCount: [{ n: 1, price: 120 }, { n: 2, price: 70 }, { n: 3, price: 70 }, { n: 4, price: 55 }, { n: 6, price: 50 }] },
};
test('per_count : prix par personne selon la taille du groupe', () => {
  assert.equal(computeExcursionPrice(byCount, { participants: { adult: 1 } }).totalEur, 120);
  assert.equal(computeExcursionPrice(byCount, { participants: { adult: 2 } }).totalEur, 140);
  assert.equal(computeExcursionPrice(byCount, { participants: { adult: 4 } }).totalEur, 220);
  // 5 n'est pas renseigné : on prend la ligne du dessous (4 → 55 €)
  assert.equal(computeExcursionPrice(byCount, { participants: { adult: 5 } }).totalEur, 275);
  assert.equal(computeExcursionPrice(byCount, { participants: { adult: 6 } }).perPerson, 50);
});
test('per_count : enfants et bébés avec réduction, comptés dans la taille du groupe', () => {
  const r = computeExcursionPrice(byCount, { participants: { adult: 2, child: 1, infant: 1 } });
  assert.equal(r.unitReducedPrice, 55);        // groupe de 4
  assert.equal(r.totalEur, 55 * 2 + 27.5 + 0);
});
test('per_count : capacité = dernier nombre, au-delà devis ; palier suivant', () => {
  assert.equal(capacityOf(byCount), 6);
  assert.equal(computeExcursionPrice(byCount, { participants: { adult: 7 } }).overCapacity, true);
  assert.deepEqual(computeExcursionPrice(byCount, { participants: { adult: 2 } }).nextTier, { n: 4, price: 55, missing: 2 });
  assert.equal(computeExcursionPrice(byCount, { participants: { adult: 6 } }).nextTier, undefined);
  assert.deepEqual(fromPrice(byCount), { amount: 50, per: 'person', from: 6 });
  assert.equal(priceForCount({ byCount: [] }, 3), null);
  assert.equal(computeExcursionPrice({ pricing: { mode: 'per_count', byCount: [] } }, { participants: { adult: 2 } }).quote, true);
  assert.deepEqual(countTable({ byCount: [{ n: 3, price: 10 }, { n: 1, price: '' }, { n: 2, price: 20 }] }).map((r) => r.n), [2, 3]);
});
test('per_count : un total saisi (200 € pour 3) est respecté au centime', () => {
  const ex = { pricing: { mode: 'per_count', byCount: [{ n: 3, price: 200 / 3 }, { n: 7, price: 500 / 7 }] } };
  const r = computeExcursionPrice(ex, { participants: { adult: 3 } });
  assert.equal(r.totalEur, 200);
  assert.equal(r.perPerson, 66.67);
  assert.equal(computeExcursionPrice(ex, { participants: { adult: 7 } }).totalEur, 500);
  assert.equal(computeExcursionPrice(ex, { participants: { adult: 2, child: 1 } }).totalEur, 200);
});
test('prix affiché sur la carte : prioritaire sur le calcul, vide = automatique', () => {
  const base = { pricing: { mode: 'per_count', byCount: [{ n: 1, price: 120 }, { n: 6, price: 50 }] } };
  assert.deepEqual(fromPrice(base), { amount: 50, per: 'person', from: 6 });
  assert.deepEqual(fromPrice({ pricing: { ...base.pricing, cardPrice: { amount: 45, per: 'person', from: 4 } } }), { amount: 45, per: 'person', from: 4, custom: true });
  assert.deepEqual(fromPrice({ pricing: { ...base.pricing, cardPrice: { amount: 300, per: 'group' } } }), { amount: 300, per: 'group', from: null, custom: true });
  assert.deepEqual(fromPrice({ pricing: { ...base.pricing, cardPrice: { amount: null } } }), { amount: 50, per: 'person', from: 6 });
  assert.equal(fromPrice({ pricing: { mode: 'quote', cardPrice: { amount: 80 } } }).amount, 80);
  // le calcul de la réservation n'est pas modifié
  assert.equal(computeExcursionPrice({ pricing: { ...base.pricing, cardPrice: { amount: 1 } } }, { participants: { adult: 1 } }).totalEur, 120);
});
