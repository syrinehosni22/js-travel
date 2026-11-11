/**
 * Nettoyage des textes saisis ou copiés-collés.
 * Les numéros copiés depuis WhatsApp ou un téléphone contiennent souvent des caractères invisibles
 * (marques de sens d'écriture U+202A…U+202E, U+2066…U+2069, espaces insécables étroites…).
 */
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export function cleanText(s) {
  if (s == null) return s;
  return String(s).replace(INVISIBLE, '').replace(/[   ]/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

// Caractères que les polices intégrées des PDF (encodage WinAnsi) savent afficher en plus du Latin-1
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const REPLACE = { '→': '–', '⇄': '–', '⇒': '–', '➔': '–', '←': '–', '≈': '~', '✓': 'v', '★': '*', '·': '·' };

/** Texte affichable dans le bon PDF : nettoyé, flèches remplacées, caractères non pris en charge translittérés */
export function pdfText(s) {
  const t = cleanText(s);
  if (!t) return t || '';
  let out = '';
  for (const ch of t) {
    const c = ch.codePointAt(0);
    if (c < 0x80 || (c >= 0xA0 && c <= 0xFF) || WIN_ANSI_EXTRA.has(ch)) out += ch;
    else if (REPLACE[ch]) out += REPLACE[ch];
    else {
      const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');   // ex. ā → a, ł reste
      out += [...base].every((x) => x.codePointAt(0) < 0x80) && base ? base : '';
    }
  }
  return out.replace(/\s{2,}/g, ' ');
}
