/** Contenu par défaut de l'accueil, utilisé tant que rien n'est saisi dans Admin → Page d'accueil */
export const DEFAULT_SLIDES = ['sidiBouSaidStreet', 'ksarGhilane', 'djerbaBeach'];
export const DEFAULT_DESTINATIONS = [
  { name: 'Sidi Bou Saïd', image: 'sidiBouSaidSea', q: 'Sidi' },
  { name: 'Sahara', image: 'saharaDune', category: 'desert' },
  { name: 'Djerba', image: 'houmtSouk', q: 'Djerba' },
  { name: 'Tozeur & Chebika', image: 'southPalm', q: 'Tozeur' },
  { name: 'El Jem', image: 'elJem', q: 'Jem' },
];
/** Pages vers lesquelles le bouton du bandeau peut renvoyer */
export const BANNER_TARGETS = { transfers: 'Transferts', excursions: 'Excursions', custom: 'Excursion sur mesure', contact: 'Contact' };
