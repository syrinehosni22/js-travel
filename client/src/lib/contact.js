/** Lien « appeler » : tel:+21624500358 (espaces, points et tirets retirés) */
export function telHref(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  return `tel:${raw.startsWith('+') || raw.startsWith('00') ? '+' : ''}${digits.replace(/^00/, '')}`;
}

/** Lien « nouvel e-mail » : mailto:adresse (avec un objet facultatif) */
export function mailHref(email, subject) {
  const e = String(email || '').trim();
  if (!/.+@.+\..+/.test(e)) return null;
  return `mailto:${e}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
}
