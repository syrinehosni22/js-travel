/** Ordre d'affichage des excursions : position choisie dans l'admin, puis popularité, puis la plus ancienne d'abord. */
export function byDisplayOrder(a, b) {
  const pa = Number.isFinite(a.position) ? a.position : Infinity;
  const pb = Number.isFinite(b.position) ? b.position : Infinity;
  if (pa !== pb) return pa - pb;
  if ((b.popularity || 0) !== (a.popularity || 0)) return (b.popularity || 0) - (a.popularity || 0);
  return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
}
