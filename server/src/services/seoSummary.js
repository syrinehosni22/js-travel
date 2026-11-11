import { seoErrors, seoScore } from './seo.js';

const LANGS = ['en', 'fr', 'de', 'it', 'es'];
const PAGES_PER_LANG = 7; // accueil + excursions, transferts, sur mesure, blog, FAQ, contact

/**
 * Bilan SEO global du site pour le tableau de bord admin.
 * Fonction pure (sans base de données) : facile à tester.
 * @returns { score, light, checks[], langs{}, issues[], counts{} }
 */
export function seoSummary({ excursions = [], posts = [], routes = [], settings = {}, siteUrl = '' }) {
  const published = excursions.filter((e) => e.published);

  // 1. Qualité des fiches publiées, langue par langue
  const langs = {};
  const pageScores = [];
  const issues = [];
  for (const l of LANGS) {
    const live = published.filter((e) => (e.publishedLangs || []).includes(l));
    const scores = live.map((e) => {
      const s = seoScore(e, l);
      const missing = seoErrors(e, l);
      pageScores.push(s.score);
      if (s.score < 80 || missing.length) {
        issues.push({ id: String(e._id), title: e.title?.fr || e.title?.en || '—', lang: l, score: s.score, missing, failed: s.checks.filter((c) => !c.ok).map((c) => c.key) });
      }
      return s.score;
    });
    langs[l] = { published: live.length, avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null };
  }

  // 2. Vérifications à l'échelle du site
  const dup = (field) => {
    const seen = new Map(); const out = [];
    for (const e of published) for (const l of e.publishedLangs || []) {
      const v = (e.seo?.[l]?.[field] || '').trim().toLowerCase();
      if (!v) continue;
      const k = `${l}|${v}`;
      if (seen.has(k) && seen.get(k) !== String(e._id)) out.push({ lang: l, value: e.seo[l][field] });
      else seen.set(k, String(e._id));
    }
    return out;
  };
  const homeMissing = LANGS.filter((l) => !settings.seoHome?.[l]?.metaTitle || !settings.seoHome?.[l]?.metaDescription);
  const noAlt = published.filter((e) => (e.publishedLangs || []).some((l) => !e.images?.[0]?.alt?.[l])).length;
  const incomplete = published.filter((e) => (e.publishedLangs || []).some((l) => seoErrors(e, l).length)).length;
  const noImage = published.filter((e) => !e.images?.length).length;
  const host = siteUrl.replace(/^https?:\/\//, '');
  const livePosts = posts.filter((p) => p.published);
  const liveRoutes = routes.filter((r) => r.published);
  const langsCovered = LANGS.filter((l) => langs[l].published > 0);

  const checks = [
    { key: 'domain', ok: !!siteUrl && !/localhost|127\.0\.0\.1|^\d+\.\d+\.\d+\.\d+/.test(host), value: siteUrl },
    { key: 'https', ok: siteUrl.startsWith('https://'), value: siteUrl },
    { key: 'homeMeta', ok: homeMissing.length === 0, value: homeMissing },
    { key: 'excursionsPublished', ok: published.length >= 3, value: published.length },
    { key: 'requiredFields', ok: incomplete === 0, value: incomplete },
    { key: 'imageAlt', ok: noAlt === 0 && noImage === 0, value: noAlt + noImage },
    { key: 'duplicateKeywords', ok: dup('focusKeyword').length === 0, value: dup('focusKeyword') },
    { key: 'duplicateTitles', ok: dup('metaTitle').length === 0, value: dup('metaTitle') },
    { key: 'languages', ok: langsCovered.length === LANGS.length, value: LANGS.filter((l) => !langsCovered.includes(l)) },
    { key: 'blog', ok: livePosts.length >= 3, value: livePosts.length },
    { key: 'transferPages', ok: liveRoutes.length >= 1, value: liveRoutes.length },
    { key: 'localBusiness', ok: !!(settings.contact?.phone && settings.contact?.address && !/^\[/.test(settings.contact.phone)), value: null },
    { key: 'reviews', ok: !!settings.reviews?.rating, value: settings.reviews?.rating || null },
  ];

  // 3. Score global : 60 % qualité des fiches, 40 % vérifications du site
  const pagesAvg = pageScores.length ? pageScores.reduce((a, b) => a + b, 0) / pageScores.length : 0;
  const checksAvg = (checks.filter((c) => c.ok).length / checks.length) * 100;
  const score = Math.round(pagesAvg * 0.6 + checksAvg * 0.4);

  const sitemapUrls = LANGS.length * PAGES_PER_LANG
    + published.reduce((n, e) => n + (e.publishedLangs || []).filter((l) => e.slug?.[l] && e.seo?.[l]?.index !== false).length, 0)
    + livePosts.reduce((n, p) => n + LANGS.filter((l) => p.slug?.[l]).length, 0)
    + liveRoutes.reduce((n, r) => n + LANGS.filter((l) => r.slug?.[l]).length, 0);

  return {
    score, light: score >= 80 ? 'green' : score >= 50 ? 'orange' : 'red',
    checks, langs,
    issues: issues.sort((a, b) => a.score - b.score).slice(0, 8),
    issuesTotal: issues.length,
    counts: { excursions: excursions.length, published: published.length, posts: livePosts.length, transferPages: liveRoutes.length, sitemapUrls },
    siteUrl,
  };
}
