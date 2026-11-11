import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seoSummary } from '../src/services/seoSummary.js';

const L = (fr) => ({ fr, en: '', de: '', it: '', es: '' });
const exc = (id, kw) => ({
  _id: id, published: true, publishedLangs: ['fr'], title: L('Excursion ' + id), slug: L('excursion-' + id),
  summary: L('Résumé'), description: L('Texte'), images: [{ url: '/x.jpg', alt: L('photo') }],
  seo: { fr: { focusKeyword: kw, metaTitle: 'Titre ' + id, metaDescription: 'Description', h1: 'H1 ' + id } },
});

test('bilan vide : score bas, aucune fiche', () => {
  const r = seoSummary({ siteUrl: 'http://localhost:5173' });
  assert.equal(r.counts.published, 0);
  assert.equal(r.checks.find((c) => c.key === 'domain').ok, false);
  assert.ok(r.score < 50);
  assert.equal(r.counts.sitemapUrls, 35);
});

test('mots-clés en double détectés et fiches à améliorer listées', () => {
  const r = seoSummary({ excursions: [exc('a', 'sahara'), exc('b', 'sahara')], siteUrl: 'https://js-travel.tn', settings: {} });
  assert.equal(r.checks.find((c) => c.key === 'duplicateKeywords').ok, false);
  assert.equal(r.checks.find((c) => c.key === 'https').ok, true);
  assert.equal(r.langs.fr.published, 2);
  assert.ok(r.issues.length > 0 && r.issues[0].lang === 'fr');
  assert.equal(r.counts.sitemapUrls, 37);
});
