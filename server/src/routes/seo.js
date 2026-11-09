import { Router } from 'express';
import { Excursion, Post, TransferRoute, Redirect } from '../models/index.js';
import { LANGS, config } from '../config.js';

/** sitemap.xml multilingue avec hreflang, robots.txt et redirections 301 (§6, §8.1) */
const r = Router();
const PAGES = { excursions: 'excursions', transfers: 'transfers', custom: 'custom', blog: 'blog', faq: 'faq', contact: 'contact' };

function urlEntry(paths, lastmod) {
  // paths : { en: '/en/...', fr: '/fr/...' }
  const alternates = Object.entries(paths).map(([l, p]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${config.siteUrl}${p}"/>`).join('')
    + (paths.en ? `<xhtml:link rel="alternate" hreflang="x-default" href="${config.siteUrl}${paths.en}"/>` : '');
  return Object.values(paths).map((p) => `<url><loc>${config.siteUrl}${p}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}${alternates}</url>`).join('');
}

r.get('/sitemap.xml', async (_req, res) => {
  const [excursions, posts, routes] = await Promise.all([
    Excursion.find({ published: true }).select('slug publishedLangs updatedAt seo').lean(),
    Post.find({ published: true }).select('slug updatedAt').lean(),
    TransferRoute.find({ published: true }).select('slug updatedAt').lean(),
  ]);
  let xml = '';
  xml += urlEntry(Object.fromEntries(LANGS.map((l) => [l, `/${l}/`])));
  for (const p of Object.values(PAGES)) xml += urlEntry(Object.fromEntries(LANGS.map((l) => [l, `/${l}/${p}`])));
  for (const e of excursions) {
    const langs = (e.publishedLangs || []).filter((l) => e.slug?.[l] && e.seo?.[l]?.index !== false);
    if (langs.length) xml += urlEntry(Object.fromEntries(langs.map((l) => [l, `/${l}/excursions/${e.slug[l]}`])), e.updatedAt);
  }
  for (const p of posts) xml += urlEntry(Object.fromEntries(LANGS.filter((l) => p.slug?.[l]).map((l) => [l, `/${l}/blog/${p.slug[l]}`])), p.updatedAt);
  for (const t of routes) xml += urlEntry(Object.fromEntries(LANGS.filter((l) => t.slug?.[l]).map((l) => [l, `/${l}/transfers/${t.slug[l]}`])), t.updatedAt);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${xml}</urlset>`);
});

r.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
});

/** Redirections 301 enregistrées lors des changements de slug */
r.use(async (req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads') || /\.[a-z0-9]+$/i.test(req.path)) return next();
  const x = await Redirect.findOne({ from: req.path.replace(/\/$/, '') }).lean();
  if (x) return res.redirect(301, x.to);
  next();
});

export default r;
