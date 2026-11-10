/**
 * Lien WhatsApp « click to chat » vers le numéro configuré dans l'admin (Paramètres → Contact).
 * Accepte « +216 98 123 456 », « 00216 98123456 » ou « 98 123 456 » (numéro tunisien local).
 * Renvoie null si aucun numéro valide n'est configuré : le bouton n'est alors pas affiché.
 */
export function waNumber(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 8) d = '216' + d;          // numéro local tunisien sans indicatif
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function waLink(raw, text) {
  const n = waNumber(raw);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
