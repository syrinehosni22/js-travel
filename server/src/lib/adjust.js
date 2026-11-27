/**
 * Remise ou prix manuel sur une prestation (admin).
 * - percent : remise en % du prix d'origine (0 = retour au prix d'origine)
 * - amount  : nouveau prix de la prestation, saisi à la main
 * - reset   : retour au prix d'origine
 * Le prix d'origine est gardé dans basePriceEur ; une ligne « adminDiscount » explique l'écart
 * (montant négatif = remise, positif = supplément). Renvoie { before, after }.
 */
const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;

export function applyItemPrice(item, { mode, value, reason } = {}) {
  const before = round2(item.totalEur || 0);
  const base = round2(item.basePriceEur ?? before);
  let after;
  if (mode === 'reset') after = base;
  else if (mode === 'percent') {
    const p = Math.min(100, Math.max(0, +value || 0));
    after = round2(base * (1 - p / 100));
  } else if (mode === 'amount') after = Math.max(0, round2(+value || 0));
  else throw new Error(`Mode de prix inconnu : ${mode}`);

  const lines = (item.lines || []).filter((l) => l.key !== 'adminDiscount');
  if (after !== base) {
    lines.push({ key: 'adminDiscount', label: reason || (after < base ? 'Remise' : 'Ajustement'), rate: base ? round2((base - after) / base * 10000) / 10000 : 0, amount: round2(after - base) });
    item.basePriceEur = base;
  } else {
    item.basePriceEur = undefined;
  }
  item.lines = lines;
  item.totalEur = after;
  return { before, after, base };
}

/** Total de la réservation après changement de prix d'une prestation */
export const applyTotal = (total, { before, after }) => round2((total || 0) + after - before);
