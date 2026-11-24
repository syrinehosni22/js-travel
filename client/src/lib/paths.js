/**
 * Segments d'adresse traduits par langue (ex. /fr/transferts, /de/ausfluege).
 * Fichier partagé : client/src/lib/paths.js et server/src/lib/paths.js doivent rester identiques.
 */
export const PATHS = {
  en: { excursions: 'excursions', transfers: 'transfers', custom: 'tailor-made', blog: 'blog', faq: 'faq', contact: 'contact', cart: 'cart', checkout: 'checkout', booking: 'booking', legal: 'legal' },
  fr: { excursions: 'excursions', transfers: 'transferts', custom: 'sur-mesure', blog: 'blog', faq: 'faq', contact: 'contact', cart: 'panier', checkout: 'reservation', booking: 'ma-reservation', legal: 'mentions' },
  de: { excursions: 'ausfluege', transfers: 'transfers', custom: 'massgeschneidert', blog: 'blog', faq: 'faq', contact: 'kontakt', cart: 'warenkorb', checkout: 'buchung', booking: 'meine-buchung', legal: 'rechtliches' },
  it: { excursions: 'escursioni', transfers: 'trasferimenti', custom: 'su-misura', blog: 'blog', faq: 'faq', contact: 'contatti', cart: 'carrello', checkout: 'prenotazione', booking: 'la-mia-prenotazione', legal: 'note-legali' },
  es: { excursions: 'excursiones', transfers: 'traslados', custom: 'a-medida', blog: 'blog', faq: 'faq', contact: 'contacto', cart: 'cesta', checkout: 'reserva', booking: 'mi-reserva', legal: 'legal' },
};
