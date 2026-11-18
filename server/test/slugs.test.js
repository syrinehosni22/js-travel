import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followsTitle, firstFreeSlug, planSlugRepairs, PLACEHOLDER_SLUG } from '../src/lib/slugs.js';

test('l’adresse suit le titre tant qu’elle n’a pas été personnalisée', () => {
  assert.equal(followsTitle('nouvelle-excursion', 'Nouvelle excursion'), true);
  assert.equal(followsTitle('nouvelle-excursion-2', 'Nouvelle excursion'), true);
  assert.equal(followsTitle('carthage-copie', 'Carthage (copie)'), true);
  assert.equal(followsTitle('excursion-carthage-sidi-bou-said', 'Nouvelle excursion'), false);
  assert.equal(followsTitle('', 'Nouvelle excursion'), false);
});

test('adresse libre : -2, -3… si déjà prise', async () => {
  assert.equal(await firstFreeSlug('djerba', new Set()), 'djerba');
  assert.equal(await firstFreeSlug('djerba', new Set(['djerba', 'djerba-2'])), 'djerba-3');
  assert.equal(await firstFreeSlug('djerba', async (s) => s === 'djerba'), 'djerba-2');
});

test('réparation : deux fiches « nouvelle-excursion » prennent l’adresse de leur titre', async () => {
  const docs = [
    { _id: 'a', slug: { fr: 'nouvelle-excursion', en: 'new-excursion' }, title: { fr: 'Circuit Djerba 3 jours', en: 'Djerba 3-day tour' } },
    { _id: 'b', slug: { fr: 'nouvelle-excursion', en: 'new-excursion' }, title: { fr: 'Sud tunisien 3 jours', en: 'Southern Tunisia 3 days' } },
    { _id: 'c', slug: { fr: 'carthage', en: 'carthage' }, title: { fr: 'Carthage', en: 'Carthage' } },
    { _id: 'd', slug: { fr: 'carthage', en: '' }, title: { fr: 'Carthage', en: '' } },          // doublon
    { _id: 'e', slug: { fr: 'nouvelle-excursion-2' }, title: { fr: 'Nouvelle excursion' } },    // brouillon pas encore renommé : gardé
  ];
  const ch = await planSlugRepairs(docs, ['fr', 'en']);
  const get = (id, l) => ch.find((c) => c.id === id && c.lang === l)?.to;
  assert.equal(get('a', 'fr'), 'circuit-djerba-3-jours');
  assert.equal(get('b', 'fr'), 'sud-tunisien-3-jours');
  assert.equal(get('a', 'en'), 'djerba-3-day-tour');
  assert.equal(get('b', 'en'), 'southern-tunisia-3-days');
  assert.equal(get('c', 'fr'), undefined);
  assert.equal(get('d', 'fr'), 'carthage-2');
  assert.equal(get('e', 'fr'), undefined);
  // plus aucune adresse en double
  for (const l of ['fr', 'en']) {
    const final = docs.map((d) => ch.find((c) => c.id === d._id && c.lang === l)?.to || d.slug[l]).filter(Boolean);
    assert.equal(new Set(final).size, final.length, l);
  }
  assert.equal(PLACEHOLDER_SLUG.test('nouvelle-excursion-copie'), true);
});
