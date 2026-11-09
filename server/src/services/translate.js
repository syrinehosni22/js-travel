/**
 * Traduction automatique du contenu saisi dans l'admin (§6).
 *
 * Fournisseur :
 *   - DeepL si DEEPL_API_KEY est défini (recommandé : clé gratuite, 500 000 caractères / mois, meilleure qualité)
 *   - sinon MyMemory (gratuit, sans clé, mais limité : ~5 000 caractères / jour, 50 000 avec MYMEMORY_EMAIL)
 *   - TRANSLATE_PROVIDER=off pour désactiver ; =mock pour les tests
 *
 * Règle de remplissage (langue source = TRANSLATE_SOURCE, « fr » par défaut) :
 *   - un champ vide dans une autre langue est toujours rempli ;
 *   - si le texte français change, les autres langues sont retraduites, sauf celles marquées « Relu »
 *     et sauf si la traduction a été modifiée à la main dans le même enregistrement ;
 *   - « Retraduire tout » (force) écrase toutes les langues.
 */
import { LANGS, config } from '../config.js';

const cache = new Map();
const PROVIDER = () => {
  const p = (process.env.TRANSLATE_PROVIDER || '').toLowerCase();
  if (p === 'off' || p === 'mock') return p;
  return config.deeplKey ? 'deepl' : 'mymemory';
};
export const translationProvider = PROVIDER;
export const SOURCE_LANG = () => (LANGS.includes(process.env.TRANSLATE_SOURCE) ? process.env.TRANSLATE_SOURCE : 'fr');

async function deepl(texts, source, target) {
  const host = config.deeplKey.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
  const out = [];
  for (let i = 0; i < texts.length; i += 50) {
    const res = await fetch(`https://${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${config.deeplKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texts.slice(i, i + 50), source_lang: source.toUpperCase(), target_lang: target === 'en' ? 'EN-GB' : target.toUpperCase(), tag_handling: 'html', preserve_formatting: true }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`DeepL ${res.status}${res.status === 456 ? ' (quota mensuel atteint)' : res.status === 403 ? ' (clé invalide)' : ''}`);
    const json = await res.json();
    out.push(...json.translations.map((t) => t.text));
  }
  return out;
}

/** MyMemory : une requête par texte (500 octets max) → découpage par phrases */
async function mymemoryOne(text, source, target) {
  const parts = [];
  let cur = '';
  for (const s of text.split(/(?<=[.!?\n])\s+/)) {
    if ((cur + ' ' + s).length > 450 && cur) { parts.push(cur); cur = s; } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) parts.push(cur);
  const out = [];
  for (const p of parts) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(p)}&langpair=${source}|${target}${process.env.MYMEMORY_EMAIL ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}` : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const json = await res.json().catch(() => ({}));
    if (json.responseStatus !== 200 && json.responseStatus !== '200') throw new Error(`MyMemory : ${json.responseDetails || res.status}${json.quotaFinished ? ' (quota du jour atteint — ajoutez DEEPL_API_KEY)' : ''}`);
    out.push(json.responseData.translatedText);
  }
  return out.join(' ');
}
async function mymemory(texts, source, target) {
  const out = new Array(texts.length);
  let i = 0;
  const worker = async () => { while (i < texts.length) { const k = i++; out[k] = await mymemoryOne(texts[k], source, target); } };
  await Promise.all([worker(), worker(), worker()]);
  return out;
}

/** Traduit une liste de textes (avec cache et dédoublonnage). */
export async function translateTexts(texts, source, target) {
  const provider = PROVIDER();
  if (provider === 'off') throw new Error('Traduction automatique désactivée (TRANSLATE_PROVIDER=off)');
  const key = (t) => `${provider}|${source}|${target}|${t}`;
  const todo = [...new Set(texts.filter((t) => t && !cache.has(key(t))))];
  if (todo.length) {
    const res = provider === 'mock' ? todo.map((t) => `[${target}] ${t}`)
      : provider === 'deepl' ? await deepl(todo, source, target) : await mymemory(todo, source, target);
    todo.forEach((t, i) => cache.set(key(t), res[i]));
  }
  return texts.map((t) => (t ? cache.get(key(t)) : t));
}

/* ---------- Parcours des documents ---------- */

const isL = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
  && Object.keys(v).length > 0 && Object.keys(v).every((k) => LANGS.includes(k))
  && Object.values(v).every((x) => x == null || typeof x === 'string');

/** Champs jamais traduits automatiquement */
const SKIP = new Set(['_id', 'slug', 'slugHistory', 'seo', 'translation', 'publishedLangs', 'guideLanguages', 'departureCities', 'startTimes', 'badges', 'key', 'url', 'grid']);

/** Repère tous les champs traduits { en, fr, de, it, es } d'un objet (et leur valeur précédente). */
function collect(node, prev, out) {
  if (Array.isArray(node)) { node.forEach((x, i) => collect(x, Array.isArray(prev) ? prev[i] : undefined, out)); return; }
  if (isL(node)) { out.push({ get: (l) => node[l] || '', set: (l, v) => { node[l] = v; }, prev: (l) => prev?.[l] || '' }); return; }
  if (node && typeof node === 'object' && !(node instanceof Date)) {
    for (const k of Object.keys(node)) if (!SKIP.has(k)) collect(node[k], prev?.[k], out);
  }
}

/** Fiches SEO { en: { metaTitle… }, fr: {…} } traitées comme des champs traduits */
function collectSeo(seo, prevSeo, out) {
  if (!seo || typeof seo !== 'object') return;
  for (const f of ['focusKeyword', 'metaTitle', 'metaDescription', 'h1', 'ogTitle', 'ogDescription']) {
    out.push({
      get: (l) => seo[l]?.[f] || '',
      set: (l, v) => { seo[l] = { ...(seo[l] || {}), [f]: v }; },
      prev: (l) => prevSeo?.[l]?.[f] || '',
    });
  }
}

/**
 * Complète les traductions d'un objet (modifié sur place).
 * @param data     données envoyées par l'admin (objet simple)
 * @param before   version enregistrée précédente (objet simple) ou null
 * @param opts.reviewed  langues à ne pas écraser ({ de: true })
 * @param opts.force     retraduire toutes les langues
 * @returns { languages: { de: 12, … }, error }
 */
export async function autoTranslate(data, before = null, { reviewed = {}, force = false, seo = false, source = SOURCE_LANG() } = {}) {
  const fields = [];
  collect(data, before, fields);
  if (seo) collectSeo(data.seo, before?.seo, fields);
  const result = { languages: {}, error: null, provider: PROVIDER() };
  if (result.provider === 'off') return result;

  for (const target of LANGS.filter((l) => l !== source)) {
    const jobs = fields.filter((f) => {
      const src = f.get(source).trim();
      if (!src) return false;
      if (force) return true;
      const cur = f.get(target);
      if (!cur.trim()) return true;
      const sourceChanged = before && f.prev(source) && f.prev(source) !== f.get(source);
      const editedByHand = before && cur !== f.prev(target);
      return sourceChanged && !reviewed[target] && !editedByHand;
    });
    if (!jobs.length) continue;
    try {
      const out = await translateTexts(jobs.map((f) => f.get(source)), source, target);
      jobs.forEach((f, i) => { if (out[i]) f.set(target, out[i]); });
      result.languages[target] = jobs.length;
    } catch (e) {
      result.error = e.message;
      break; // même cause pour toutes les langues : inutile d'insister
    }
  }
  return result;
}
