import { Settings } from '../models/index.js';
import { config } from '../config.js';

let cache = null;
let cachedAt = 0;

export async function getSettings() {
  if (cache && Date.now() - cachedAt < 60_000) return cache;
  cache = (await Settings.findOne().lean()) || (await Settings.create({})).toObject();
  cachedAt = Date.now();
  return cache;
}
export const clearSettingsCache = () => { cache = null; };

/** Taux EUR → devise. EUR par défaut ; GBP et TND en affichage (§6). */
export async function rateFor(currency = 'EUR') {
  if (currency === 'EUR') return 1;
  const s = await getSettings();
  return s.fx?.[currency] || null;
}

/** Mise à jour quotidienne des taux (open.er-api.com fournit EUR→TND et EUR→GBP sans clé). */
export async function refreshRates() {
  const s = await getSettings();
  if ((s.fx?.mode || config.fxMode) === 'manual') return;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR');
    const json = await res.json();
    if (json.result !== 'success') throw new Error('réponse invalide');
    await Settings.updateOne({}, { $set: { 'fx.GBP': json.rates.GBP, 'fx.TND': json.rates.TND, 'fx.updatedAt': new Date() } });
    clearSettingsCache();
    console.log('[fx] taux mis à jour', json.rates.GBP, json.rates.TND);
  } catch (e) {
    console.warn('[fx] mise à jour impossible, taux précédents conservés :', e.message);
  }
}
