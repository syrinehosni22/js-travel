/** Chaque texte de l'interface existe dans les 5 langues (aucun repli silencieux sur l'anglais). */
import { describe, it, expect } from 'vitest';
import { RESOURCES, LANGS } from '../src/i18n.js';

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}
const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

describe('traductions', () => {
  const ref = keys(RESOURCES.en);
  for (const l of LANGS) {
    it(`${l} contient toutes les clés`, () => {
      const missing = ref.filter((k) => { const v = get(RESOURCES[l], k); return v == null || v === '' || (Array.isArray(v) && v.length === 0); });
      expect(missing).toEqual([]);
    });
    it(`${l} n'a pas de clé inconnue`, () => {
      const extra = keys(RESOURCES[l]).filter((k) => !ref.includes(k));
      expect(extra).toEqual([]);
    });
  }
  it('les variables {{x}} sont identiques dans chaque langue', () => {
    const vars = (s) => (typeof s === 'string' ? (s.match(/{{\w+}}/g) || []).sort().join() : '');
    const bad = [];
    for (const k of ref) for (const l of LANGS) if (vars(get(RESOURCES.en, k)) !== vars(get(RESOURCES[l], k))) bad.push(`${l}:${k}`);
    expect(bad).toEqual([]);
  });
});
