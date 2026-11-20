/**
 * Commission sur les réservations abouties (réglées sur place ou terminées).
 * Base : montant encaissé saisi par l'équipe, sinon total de la réservation.
 */
export const PAID_STATUSES = ['paid_on_site', 'completed'];
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export function commissionRows(bookings, percent) {
  const rate = (+percent || 0) / 100;
  const rows = bookings
    .filter((b) => PAID_STATUSES.includes(b.status))
    .map((b) => {
      const base = Number.isFinite(b.collectedAmount) && b.collectedAmount > 0 ? +b.collectedAmount : +b.totalEur || 0;
      return {
        ref: b.ref, date: b.firstServiceDate || '', customer: b.customer?.name || '',
        items: (b.items || []).filter((i) => i.status !== 'cancelled').map((i) => i.title).join(' + '),
        status: b.status, base: r2(base), commission: r2(base * rate),
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const total = r2(rows.reduce((s, x) => s + x.base, 0));
  return { rows, total, commission: r2(rows.reduce((s, x) => s + x.commission, 0)), percent: +percent || 0 };
}
