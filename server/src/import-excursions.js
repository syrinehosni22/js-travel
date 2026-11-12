/**
 * Import des excursions et circuits de src/data/excursions-import.js dans la base.
 *
 *   npm run import-excursions                 → importe les fiches absentes (brouillons) et les traduit
 *   npm run import-excursions -- --dry-run    → affiche ce qui serait fait, sans rien écrire
 *   npm run import-excursions -- --no-translate → français uniquement (traduire ensuite depuis l'admin)
 *
 * Règles :
 *   - chaque fiche est créée NON publiée et « sur devis » (aucun prix) : ajoutez prix et photos dans l'admin ;
 *   - une fiche déjà présente (même adresse française) n'est jamais modifiée : le script peut être relancé sans risque ;
 *   - les autres langues sont traduites comme dans l'admin (DeepL si DEEPL_API_KEY, sinon service gratuit limité).
 */
import mongoose from 'mongoose';
import { config, LANGS } from './config.js';
import { Excursion } from './models/index.js';
import { slugify, seoErrors, seoScore } from './services/seo.js';
import { autoTranslate } from './services/translate.js';
import { EXCURSIONS } from './data/excursions-import.js';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const TRANSLATE = !args.has('--no-translate');

const L = (fr = '') => Object.fromEntries(LANGS.map((l) => [l, l === 'fr' ? fr : '']));
const isClock = (t) => /^[\d:hH ]+$/.test(t || '');

/** Transforme une fiche du fichier de données en document Excursion (français seulement) */
export function toExcursion(x) {
  return {
    slug: L(slugify(x.seo.focusKeyword)),
    title: L(x.title), summary: L(x.summary), description: L([x.description.trim(), x.more?.trim()].filter(Boolean).join('\n\n')),
    highlights: x.highlights.map(L), included: x.included.map(L), notIncluded: x.notIncluded.map(L), toBring: x.toBring.map(L),
    // « Jour 1 », « Matin »… passent dans le texte pour être traduits ; seules les heures restent dans « time »
    program: x.program.map(([time, text]) => (isClock(time) ? { time, text: L(text) } : { time: '', text: L(`${time} : ${text}`) })),
    faq: x.faq.map(([q, a]) => ({ q: L(q), a: L(a) })),
    durationLabel: L(x.durationLabel), durationHours: x.durationHours,
    category: x.category, departureCities: x.departureCities, startTimes: x.startTimes || [],
    guideLanguages: ['fr', 'en'], groupSize: { min: 1, max: 8 }, badges: ['private'],
    images: x.images.map((i) => ({ url: i.url, alt: L(i.alt) })),
    itinerary: { enabled: true, stops: x.stops.map((s) => ({ name: L(s.name), note: L(s.note), lat: s.lat, lng: s.lng })) },
    pricing: { mode: 'quote', maxGroup: 8, options: [] },
    availability: { mode: 'request', confirmWithinHours: 12 },
    seo: { fr: { ...x.seo, index: true } },
    published: false, publishedLangs: [],
    translation: { fr: 'reviewed' },
  };
}

/** Adresse unique dans une langue (ajoute -2, -3… si elle existe déjà) */
async function uniqueSlug(l, base) {
  let s = base; let n = 2;
  while (await Excursion.exists({ [`slug.${l}`]: s })) s = `${base}-${n++}`;
  return s;
}

async function main() {
  console.log(`Base : ${config.mongoUri.replace(/\/\/.*@/, '//***@')}${DRY ? '  (simulation, rien n’est écrit)' : ''}`);
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  const report = { created: [], skipped: [], translationErrors: [] };

  for (const x of EXCURSIONS) {
    const data = toExcursion(x);
    const fr = data.slug.fr;
    if (await Excursion.exists({ 'slug.fr': fr })) { report.skipped.push(x.title); console.log(`= déjà présente : ${x.title}`); continue; }

    if (TRANSLATE && !DRY) {
      const tr = await autoTranslate(data, null, { seo: true });
      for (const l of Object.keys(tr.languages)) data.translation[l] = 'auto';
      if (tr.error) report.translationErrors.push(`${x.title} : ${tr.error}`);
    }
    for (const l of LANGS) {
      // Adresse de chaque langue = mot-clé principal traduit (sinon le titre), comme recommandé pour le SEO
      if (l !== 'fr') { const src = data.seo?.[l]?.focusKeyword || data.title[l]; if (src) data.slug[l] = slugify(src); }
      if (data.slug[l]) data.slug[l] = await uniqueSlug(l, data.slug[l]);
    }
    const s = seoScore(data, 'fr');
    console.log(`+ ${DRY ? 'à créer' : 'créée'} : ${x.title}  (SEO fr ${s.score}/100, ${seoErrors(data, 'fr').length} champ(s) obligatoire(s) manquant(s))`);
    if (!DRY) await Excursion.create(data);
    report.created.push(x.title);
  }

  // Liens « Vous aimerez aussi » entre fiches (adresse française → identifiant)
  if (!DRY) {
    for (const x of EXCURSIONS) {
      if (!x.related?.length) continue;
      const me = await Excursion.findOne({ 'slug.fr': slugify(x.seo.focusKeyword) });
      if (!me || me.related?.length) continue;
      const ids = (await Excursion.find({ 'slug.fr': { $in: x.related } }).select('_id').lean()).map((d) => d._id);
      if (ids.length) { me.related = ids; await me.save(); }
    }
  }

  console.log(`\n${report.created.length} fiche(s) ${DRY ? 'à créer' : 'créée(s)'} en brouillon, ${report.skipped.length} déjà présente(s).`);
  if (report.translationErrors.length) {
    console.log('\nTraduction automatique incomplète (quota du service gratuit ?) :');
    report.translationErrors.forEach((e) => console.log(`  - ${e}`));
    console.log('→ Ouvrez la fiche dans l’admin et cliquez « Retraduire » (onglet Textes), ou ajoutez DEEPL_API_KEY dans server/.env.');
  }
  console.log('\nÀ faire dans l’admin pour chaque fiche : prix (onglet Tarifs), photos, vérification des textes, puis « Publier ».');
  await mongoose.disconnect();
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  main().catch((e) => {
    console.error(e);
    if (/ECONNREFUSED|Server selection timed out/i.test(String(e?.message))) console.error('\n→ MongoDB ne répond pas. Vérifiez MONGODB_URI dans server/.env');
    process.exit(1);
  });
}
