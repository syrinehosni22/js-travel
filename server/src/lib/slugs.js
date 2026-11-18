/**
 * Adresses (slugs) des excursions : une adresse par langue, unique, qui suit le titre
 * tant qu'elle n'a pas été personnalisée.
 */
import { slugify } from './seo.js';

/** Adresses données automatiquement à une fiche tout juste créée (« Nouvelle excursion ») */
export const PLACEHOLDER_SLUG = /^(nouvelle-excursion|new-excursion|neue-exkursion|neuer-ausflug|nuova-escursione|nueva-excursion)(-copie)?(-\d+)?$/;

const base = (s) => String(s || '').replace(/-\d+$/, '');

/** L'adresse a-t-elle été produite automatiquement à partir de ce titre (avec un éventuel -2, -3…) ? */
export function followsTitle(slug, title) {
  return !!slug && !!title && base(slug) === slugify(title);
}

/** Premier slug libre : slug, slug-2, slug-3… (`taken` : fonction ou Set des slugs déjà pris) */
export async function firstFreeSlug(slug, taken) {
  if (!slug) return slug;
  const isTaken = typeof taken === 'function' ? taken : (s) => taken.has(s);
  let cand = slug;
  for (let n = 2; await isTaken(cand); n++) cand = `${slug}-${n}`;
  return cand;
}

/**
 * Réparation des fiches existantes : adresse en double ou restée « nouvelle-excursion ».
 * docs = [{ _id, slug: { fr, en… }, title: { fr, en… } }] (du plus ancien au plus récent).
 * Renvoie [{ id, lang, from, to }].
 */
export async function planSlugRepairs(docs, langs) {
  const changes = [];
  for (const l of langs) {
    const all = new Set(docs.map((d) => d.slug?.[l]).filter(Boolean));
    const kept = new Set();
    for (const d of docs) {
      const slug = d.slug?.[l];
      if (!slug) continue;
      const title = d.title?.[l];
      const wanted = title ? slugify(title) : '';
      const duplicate = kept.has(slug);
      const placeholder = PLACEHOLDER_SLUG.test(slug) && wanted && !PLACEHOLDER_SLUG.test(wanted);
      if (!duplicate && !placeholder) { kept.add(slug); continue; }
      // nouvelle adresse depuis le titre ; à défaut (titre vide), l'ancienne avec un numéro
      // pris = déjà gardé, ou adresse d'une autre fiche
      const to = await firstFreeSlug(wanted && !PLACEHOLDER_SLUG.test(wanted) ? wanted : slug, (s) => kept.has(s) || (all.has(s) && s !== slug));
      kept.add(to); all.add(to);
      if (to !== slug) changes.push({ id: d._id, lang: l, from: slug, to });
    }
  }
  return changes;
}
