const LANGS = ['en', 'fr', 'de', 'it', 'es'];

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'a', 'au', 'aux', 'un', 'une', 'the', 'and', 'of', 'to', 'in', 'der', 'die', 'das', 'und', 'il', 'lo', 'gli', 'e', 'di', 'el', 'los', 'las', 'y']);

/** Slug sans accents ni mots vides (§8.2) */
export function slugify(text = '') {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .filter((w) => w && !STOP.has(w)).join('-').slice(0, 80);
}

/** Champs obligatoires d'une langue avant publication (§8.2) */
export function seoErrors(doc, lang) {
  const seo = doc.seo?.[lang] || {};
  const errs = [];
  if (!doc.title?.[lang]) errs.push('title');
  if (!seo.focusKeyword) errs.push('focusKeyword');
  if (!seo.metaTitle) errs.push('metaTitle');
  if (!seo.metaDescription) errs.push('metaDescription');
  if (!doc.slug?.[lang]) errs.push('slug');
  if (!seo.h1) errs.push('h1');
  if (doc.images && !(doc.images[0]?.alt?.[lang])) errs.push('mainImageAlt');
  return errs;
}

/** Score « à la Yoast » : feux vert / orange / rouge et liste de corrections (§8.2) */
export function seoScore(doc, lang) {
  const seo = doc.seo?.[lang] || {};
  const kw = (seo.focusKeyword || '').toLowerCase().trim();
  const text = [doc.summary?.[lang], doc.description?.[lang]].join(' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  const firstPara = (doc.description?.[lang] || doc.summary?.[lang] || '').split(/\n\s*\n/)[0].toLowerCase();
  const has = (s) => !!kw && (s || '').toLowerCase().includes(kw);
  const checks = [
    { key: 'kwInTitle', ok: has(seo.metaTitle) },
    { key: 'kwInSlug', ok: !!kw && (doc.slug?.[lang] || '').includes(slugify(kw)) },
    { key: 'kwInH1', ok: has(seo.h1) },
    { key: 'kwInFirstParagraph', ok: has(firstPara) },
    { key: 'kwInAlt', ok: (doc.images || []).some((i) => has(i.alt?.[lang])) },
    { key: 'titleLength', ok: (seo.metaTitle || '').length >= 50 && (seo.metaTitle || '').length <= 60, value: (seo.metaTitle || '').length },
    { key: 'descriptionLength', ok: (seo.metaDescription || '').length >= 140 && (seo.metaDescription || '').length <= 160, value: (seo.metaDescription || '').length },
    { key: 'h1DiffersFromTitle', ok: !!seo.h1 && seo.h1 !== seo.metaTitle },
    { key: 'textLength', ok: words >= 300, value: words },
    { key: 'internalLinks', ok: (doc.related || []).length > 0 || /href=/.test(doc.description?.[lang] || '') },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  return { score, light: score >= 80 ? 'green' : score >= 50 ? 'orange' : 'red', checks };
}

/** Résumé par langue pour le tableau SEO de l'admin */
export function seoOverview(doc) {
  return Object.fromEntries(LANGS.map((l) => [l, { ...seoScore(doc, l), missing: seoErrors(doc, l) }]));
}
