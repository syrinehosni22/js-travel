import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeExcursionPrice, computeTransferQuotes, seasonFor, groupTable, minimumWarnings, discountRate, capacityOf, countTable, priceForCount, fromPrice, cityTransferFor, guideOptionOf } from '../src/lib/pricing.js';

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

/* ---------- Option guide et transfert depuis une autre ville ---------- */
const withExtras = {
  departureCities: ['Sousse', 'Monastir'],
  pricing: {
    mode: 'per_count', byCount: [{ n: 1, price: 100 }, { n: 2, price: 60 }, { n: 4, price: 50 }],
    zones: [{ key: 'hammamet', label: 'Hammamet', fee: 10 }],
    guideOption: { enabled: true, price: 30, per: 'booking' },
    cityTransfers: [{ city: 'Nabeul', price: 40, per: 'booking' }, { city: 'Djerba', price: 15, per: 'person' }],
  },
};
test('option guide : ajoutée seulement si cochée et proposée', () => {
  assert.equal(computeExcursionPrice(withExtras, { participants: { adult: 2 } }).totalEur, 120);
  const r = computeExcursionPrice(withExtras, { participants: { adult: 2 }, guide: true });
  assert.equal(r.totalEur, 150);
  assert.deepEqual(r.lines.find((l) => l.key === 'guide'), { key: 'guide', per: 'booking', qty: 1, unit: 30, amount: 30 });
  const perPerson = { ...withExtras, pricing: { ...withExtras.pricing, guideOption: { enabled: true, price: 10, per: 'person' } } };
  assert.equal(computeExcursionPrice(perPerson, { participants: { adult: 2, child: 1, infant: 1 }, guide: true }).lines.find((l) => l.key === 'guide').amount, 30);
  const off = { ...withExtras, pricing: { ...withExtras.pricing, guideOption: { enabled: false, price: 30 } } };
  assert.equal(computeExcursionPrice(off, { participants: { adult: 2 }, guide: true }).totalEur, 120);
  assert.equal(guideOptionOf(off), null);
});
test('transfert : ville de départ ou zone = gratuit, autre ville = prix configuré ou sur demande', () => {
  assert.equal(cityTransferFor(withExtras, 'sousse'), null);
  assert.equal(cityTransferFor(withExtras, ' Hammamet '), null);   // zone de prise en charge
  assert.equal(cityTransferFor(withExtras, ''), null);
  assert.deepEqual(cityTransferFor(withExtras, 'nabeul'), { city: 'Nabeul', price: 40, per: 'booking' });
  assert.equal(computeExcursionPrice(withExtras, { participants: { adult: 2 }, city: 'Nabeul' }).totalEur, 160);
  assert.equal(computeExcursionPrice(withExtras, { participants: { adult: 2 }, city: 'Djerba' }).totalEur, 150);
  const both = computeExcursionPrice(withExtras, { participants: { adult: 2 }, city: 'Nabeul', guide: true });
  assert.equal(both.totalEur, 190);
  const far = computeExcursionPrice(withExtras, { participants: { adult: 2 }, city: 'Tozeur' });
  assert.equal(far.totalEur, 120);
  assert.equal(far.cityTransferOnRequest, 'Tozeur');
  assert.equal(computeExcursionPrice(withExtras, { participants: { adult: 2 }, city: 'Monastir' }).cityTransferOnRequest, undefined);
});

/* ---------- Transferts de groupe ---------- */
test('transferts : au-delà de 20 personnes sur demande, maximum 50', () => {
  const cfg = { vehicles: [{ key: 'sedan', label: 'Berline', minPassengers: 1, maxPassengers: 4 }, { key: 'bus', label: 'Minibus', minPassengers: 5, maxPassengers: 30 }],
    grid: [{ fromZone: 'a', toZone: 'b', vehicle: 'sedan', price: 30 }, { fromZone: 'a', toZone: 'b', vehicle: 'bus', price: 90 }] };
  const q = (n, groups) => computeTransferQuotes({ ...cfg, groups }, { fromZone: 'a', toZone: 'b', passengers: { adult: n } });
  assert.equal(q(3)[0].totalEur, 30);
  assert.equal(q(20)[0].totalEur, 90);
  const g = q(21);
  assert.equal(g.length, 1);
  assert.equal(g[0].onRequest, true);
  assert.equal(g[0].group, true);
  assert.equal(g[0].minPassengers, 21);
  assert.equal(g[0].maxPassengers, 50);
  assert.equal(q(50)[0].onRequest, true);
  assert.deepEqual(q(51), []);
  assert.equal(q(25, { onRequestAbove: 30, maxPassengers: 60 })[0].totalEur, 90);   // réglage admin
});

test('minibus : un prix par tranche de passagers (8–10, 11–13, 14–16)', () => {
  const cfg = {
    vehicles: [
      { key: 'van', minPassengers: 7, maxPassengers: 8, maxLuggage: 8 },
      { key: 'minibus', minPassengers: 8, maxPassengers: 16, maxLuggage: 20, tiers: [{ from: 11, to: 13 }, { from: 8, to: 10 }, { from: 14, to: 16 }] },
    ],
    grid: [
      { fromZone: 'a', toZone: 'b', vehicle: 'van', price: 60 },
      { fromZone: 'a', toZone: 'b', vehicle: 'minibus', price: 80, minPax: 8, maxPax: 10 },
      { fromZone: 'a', toZone: 'b', vehicle: 'minibus', price: 95, minPax: 11, maxPax: 13 },
      { fromZone: 'a', toZone: 'b', vehicle: 'minibus', price: 110, minPax: 14, maxPax: 16 },
    ],
  };
  const q = (n) => computeTransferQuotes(cfg, { fromZone: 'b', toZone: 'a', passengers: { adult: n }, datetime: '2026-08-14T12:00' });
  assert.deepEqual(q(8).map((x) => [x.vehicle, x.totalEur]), [['van', 60], ['minibus', 80]]);
  const m12 = q(12).find((x) => x.vehicle === 'minibus');
  assert.equal(m12.totalEur, 95);
  assert.equal(m12.minPassengers, 11); assert.equal(m12.maxPassengers, 13);
  assert.equal(q(16)[0].totalEur, 110);
  assert.equal(q(17).length, 0);   // aucune tranche ne couvre 17 personnes
  // Tranche sans prix sur ce trajet : minibus non proposé
  cfg.grid = cfg.grid.filter((g) => g.minPax !== 14);
  assert.equal(q(15).length, 0);
});

test('déplacement : prix commun à toutes les excursions, remplacé par le prix de l’excursion', () => {
  const common = [{ city: 'Nabeul', price: 30, per: 'booking' }, { city: 'Mahdia', price: 10, per: 'person' }];
  const exc = { departureCities: ['Sousse'], pricing: { cityTransfers: [{ city: 'nabeul', price: 45, per: 'booking' }] } };
  assert.equal(cityTransferFor(exc, 'Sousse', common), null);
  assert.equal(cityTransferFor(exc, 'Nabeul', common).price, 45);           // prix de l'excursion
  assert.deepEqual(cityTransferFor(exc, ' mahdia ', common), { city: 'Mahdia', price: 10, per: 'person' });   // prix commun
  assert.equal(cityTransferFor(exc, 'Tozeur', common).onRequest, true);
  const base = { pricing: { mode: 'per_person', seasons: { mid: { adult: 50 } } }, departureCities: ['Sousse'] };
  const r = computeExcursionPrice(base, { participants: { adult: 2 }, city: 'Mahdia' }, { cityTransfers: common });
  assert.equal(r.lines.find((l) => l.key === 'cityTransfer').amount, 20);
});
