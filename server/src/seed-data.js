/**
 * Données de démarrage, dans les 5 langues (en, fr, de, it, es).
 * Les prix de Carthage reprennent l'exemple du cahier des charges (minimum 240 €, prix réduit 60 € en haute saison) ;
 * TOUS les autres prix sont des valeurs d'exemple à remplacer dans le back-office.
 *
 * Utilisé par :
 *   - le démarrage du serveur (base vide → remplie automatiquement, admin créé automatiquement)
 *   - npm run seed            → ajoute ce qui manque et complète les traductions manquantes
 *   - npm run seed -- --reset → vide la base puis la remplit
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { LANGS } from './config.js';
import { User, Excursion, Zone, Location, TransferConfig, Settings, Promo, TransferRoute } from './models/index.js';

/** Texte dans les 5 langues */
const L = (en, fr, de, it, es) => ({ en, fr, de: de ?? en, it: it ?? en, es: es ?? en });
const OTHER = ['de', 'it', 'es'];
const T = { en: 'reviewed', fr: 'reviewed', de: 'auto', it: 'auto', es: 'auto' };

/* =============================== Administrateur =============================== */

/**
 * Crée le compte administrateur s'il n'existe aucun administrateur actif.
 * Identifiants : ADMIN_EMAIL / ADMIN_PASSWORD du fichier server/.env
 * (par défaut admin@example.com / ChangeMoi123!).
 * Avec ADMIN_RESET=true dans le .env, le mot de passe de ADMIN_EMAIL est réinitialisé à chaque démarrage.
 */
export async function ensureAdmin({ log = console.log } = {}) {
  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMoi123!';
  const reset = String(process.env.ADMIN_RESET || '').toLowerCase() === 'true';

  const existing = await User.findOne({ email });
  if (existing && reset) {
    existing.passwordHash = await bcrypt.hash(password, 12);
    existing.role = 'admin'; existing.active = true; existing.twoFactorEnabled = false;
    await existing.save();
    log(`[admin] mot de passe réinitialisé pour ${email}`);
    return { email, created: false, reset: true };
  }
  if (existing) {
    if (!existing.active || existing.role !== 'admin') {
      existing.active = true; existing.role = 'admin'; await existing.save();
    }
    return { email, created: false };
  }
  // Un autre administrateur existe déjà : on ne touche à rien (sauf demande explicite avec ADMIN_RESET=true)
  if (!reset && await User.exists({ role: 'admin', active: true })) return { email, created: false };

  await User.create({ name: 'Administrateur', email, role: 'admin', active: true, passwordHash: await bcrypt.hash(password, 12) });
  log(`[admin] compte administrateur créé : ${email} (mot de passe : celui de ADMIN_PASSWORD dans server/.env)`);
  return { email, created: true };
}

/* =============================== Contenu =============================== */

const zonesPickup = [
  { key: 'sousse', label: 'Sousse', fee: 0 }, { key: 'monastir', label: 'Monastir', fee: 0 },
  { key: 'hammamet', label: 'Hammamet', fee: 10 }, { key: 'mahdia', label: 'Mahdia', fee: 15 }, { key: 'tunis', label: 'Tunis', fee: 0 },
];
const lunch = { key: 'lunch', label: L('Lunch', 'Déjeuner', 'Mittagessen', 'Pranzo', 'Almuerzo'), price: 15, per: 'person' };
const photo = { key: 'photographer', label: L('Professional photographer', 'Photographe professionnel', 'Professioneller Fotograf', 'Fotografo professionista', 'Fotógrafo profesional'), price: 60, per: 'booking' };

const seo = (by) => Object.fromEntries(Object.entries(by).map(([l, [focusKeyword, metaTitle, metaDescription, h1]]) => [l, { focusKeyword, metaTitle, metaDescription, h1, index: true }]));

const HOTEL_PICKUP = L('Hotel pick-up', 'Prise en charge à l’hôtel', 'Abholung am Hotel', 'Ritiro in hotel', 'Recogida en el hotel');
const FULL_DAY = L('Full day', 'Journée', 'Ganzer Tag', 'Giornata intera', 'Día completo');

const SETTINGS_FAQ = [
  {
    q: L('How do I pay?', 'Comment se passe le paiement ?', 'Wie bezahle ich?', 'Come si paga?', '¿Cómo se paga?'),
    a: L('No online payment: you pay on site, on the day of the service.', 'Aucun paiement en ligne : vous réglez sur place, le jour de la prestation.', 'Keine Online-Zahlung: Sie zahlen vor Ort am Tag der Leistung.', 'Nessun pagamento online: si paga sul posto, il giorno del servizio.', 'Sin pago en línea: pagas en destino, el día del servicio.'),
  },
  {
    q: L('Can I cancel?', 'Puis-je annuler ?', 'Kann ich stornieren?', 'Posso annullare?', '¿Puedo cancelar?'),
    a: L('Cancellation is free up to 24 hours before departure.', 'L’annulation est gratuite jusqu’à 24 h avant le départ.', 'Die Stornierung ist bis 24 Stunden vor der Abfahrt kostenlos.', 'La cancellazione è gratuita fino a 24 ore prima della partenza.', 'La cancelación es gratuita hasta 24 horas antes de la salida.'),
  },
  {
    q: L('Why does the price per person drop with group size?', 'Pourquoi le prix par personne baisse-t-il avec le groupe ?', 'Warum sinkt der Preis pro Person mit der Gruppengröße?', 'Perché il prezzo a persona scende con il gruppo?', '¿Por qué baja el precio por persona según el grupo?'),
    a: L('Each private tour has a minimum amount for the guide, shared between participants. From a certain group size everyone pays the reduced price.', 'Chaque excursion privée a un montant minimum pour le guide, partagé entre les participants. À partir d’un certain nombre, chacun paie le prix réduit.', 'Jeder private Ausflug hat einen Mindestbetrag für den Guide, der unter den Teilnehmern aufgeteilt wird. Ab einer bestimmten Gruppengröße zahlt jeder den reduzierten Preis.', 'Ogni escursione privata ha un importo minimo per la guida, diviso tra i partecipanti. Da un certo numero di persone, ognuno paga il prezzo ridotto.', 'Cada excursión privada tiene un importe mínimo para el guía, repartido entre los participantes. A partir de cierto número, cada uno paga el precio reducido.'),
  },
  {
    q: L('Do you pick me up at my hotel?', 'Venez-vous me chercher à mon hôtel ?', 'Holen Sie mich im Hotel ab?', 'Venite a prendermi in hotel?', '¿Me recogéis en el hotel?'),
    a: L('Yes, in Sousse, Monastir, Hammamet, Mahdia and Tunis. A supplement may apply depending on the area.', 'Oui, à Sousse, Monastir, Hammamet, Mahdia et Tunis. Un supplément peut s’appliquer selon la zone.', 'Ja, in Sousse, Monastir, Hammamet, Mahdia und Tunis. Je nach Gebiet kann ein Zuschlag anfallen.', 'Sì, a Sousse, Monastir, Hammamet, Mahdia e Tunisi. Può essere applicato un supplemento a seconda della zona.', 'Sí, en Susa, Monastir, Hammamet, Mahdia y Túnez. Puede aplicarse un suplemento según la zona.'),
  },
];
const SETTINGS_LEGAL = {
  privacy: L('[Privacy policy]', '[Politique de confidentialité]', '[Datenschutzerklärung]', '[Informativa sulla privacy]', '[Política de privacidad]'),
  cancellation: L('[Cancellation policy]', '[Politique d’annulation]', '[Stornierungsbedingungen]', '[Condizioni di cancellazione]', '[Política de cancelación]'),
  terms: L('[Terms and conditions]', '[Conditions générales]', '[Allgemeine Geschäftsbedingungen]', '[Termini e condizioni]', '[Términos y condiciones]'),
};

const ZONES = [
  ['enfidha-airport', L('Enfidha-Hammamet Airport', 'Aéroport Enfidha-Hammamet', 'Flughafen Enfidha-Hammamet', 'Aeroporto di Enfidha-Hammamet', 'Aeropuerto de Enfidha-Hammamet')],
  ['monastir-airport', L('Monastir Airport', 'Aéroport de Monastir', 'Flughafen Monastir', 'Aeroporto di Monastir', 'Aeropuerto de Monastir')],
  ['tunis-airport', L('Tunis-Carthage Airport', 'Aéroport Tunis-Carthage', 'Flughafen Tunis-Karthago', 'Aeroporto di Tunisi-Cartagine', 'Aeropuerto de Túnez-Cartago')],
  ['djerba-airport', L('Djerba Airport', 'Aéroport de Djerba', 'Flughafen Djerba', 'Aeroporto di Djerba', 'Aeropuerto de Djerba')],
  ['sousse', L('Sousse', 'Sousse', 'Sousse', 'Sousse', 'Susa')], ['monastir', L('Monastir', 'Monastir', 'Monastir', 'Monastir', 'Monastir')],
  ['hammamet', L('Hammamet', 'Hammamet', 'Hammamet', 'Hammamet', 'Hammamet')], ['mahdia', L('Mahdia', 'Mahdia', 'Mahdia', 'Mahdia', 'Mahdia')],
  ['tunis', L('Tunis', 'Tunis', 'Tunis', 'Tunisi', 'Túnez')], ['djerba', L('Djerba', 'Djerba', 'Djerba', 'Djerba', 'Yerba')],
];

/** name = identifiant interne (ne pas modifier) ; label = nom affiché dans chaque langue */
const PLACES = [
  ['Aéroport Enfidha-Hammamet (NBE)', 'airport', 'enfidha-airport', L('Enfidha-Hammamet Airport (NBE)', 'Aéroport Enfidha-Hammamet (NBE)', 'Flughafen Enfidha-Hammamet (NBE)', 'Aeroporto di Enfidha-Hammamet (NBE)', 'Aeropuerto de Enfidha-Hammamet (NBE)')],
  ['Aéroport Monastir (MIR)', 'airport', 'monastir-airport', L('Monastir Airport (MIR)', 'Aéroport Monastir (MIR)', 'Flughafen Monastir (MIR)', 'Aeroporto di Monastir (MIR)', 'Aeropuerto de Monastir (MIR)')],
  ['Aéroport Tunis-Carthage (TUN)', 'airport', 'tunis-airport', L('Tunis-Carthage Airport (TUN)', 'Aéroport Tunis-Carthage (TUN)', 'Flughafen Tunis-Karthago (TUN)', 'Aeroporto di Tunisi-Cartagine (TUN)', 'Aeropuerto de Túnez-Cartago (TUN)')],
  ['Aéroport Djerba-Zarzis (DJE)', 'airport', 'djerba-airport', L('Djerba-Zarzis Airport (DJE)', 'Aéroport Djerba-Zarzis (DJE)', 'Flughafen Djerba-Zarzis (DJE)', 'Aeroporto di Djerba-Zarzis (DJE)', 'Aeropuerto de Djerba-Zarzis (DJE)')],
  ['Sousse', 'city', 'sousse', L('Sousse', 'Sousse', 'Sousse', 'Sousse', 'Susa')],
  ['Port El Kantaoui', 'city', 'sousse', L('Port El Kantaoui', 'Port El Kantaoui', 'Port El Kantaoui', 'Port El Kantaoui', 'Port El Kantaoui')],
  ['Monastir', 'city', 'monastir', L('Monastir', 'Monastir', 'Monastir', 'Monastir', 'Monastir')],
  ['Hammamet', 'city', 'hammamet', L('Hammamet', 'Hammamet', 'Hammamet', 'Hammamet', 'Hammamet')],
  ['Yasmine Hammamet', 'city', 'hammamet', L('Yasmine Hammamet', 'Yasmine Hammamet', 'Yasmine Hammamet', 'Yasmine Hammamet', 'Yasmine Hammamet')],
  ['Mahdia', 'city', 'mahdia', L('Mahdia', 'Mahdia', 'Mahdia', 'Mahdia', 'Mahdia')],
  ['Tunis', 'city', 'tunis', L('Tunis', 'Tunis', 'Tunis', 'Tunisi', 'Túnez')],
  ['Djerba', 'city', 'djerba', L('Djerba', 'Djerba', 'Djerba', 'Djerba', 'Yerba')],
];

const VEHICLES = [
  { key: 'sedan', label: L('Sedan', 'Berline', 'Limousine', 'Berlina', 'Berlina'), minPassengers: 1, maxPassengers: 4, maxLuggage: 4, perKm: 0.9, minFare: 30 },
  { key: 'minivan', label: L('Minivan', 'Minivan', 'Minivan', 'Minivan', 'Monovolumen'), minPassengers: 5, maxPassengers: 6, maxLuggage: 6, perKm: 1.2, minFare: 40 },
  { key: 'van', label: L('Van (8 seats)', 'Van 8 places', 'Van (8 Plätze)', 'Van (8 posti)', 'Furgoneta (8 plazas)'), minPassengers: 7, maxPassengers: 8, maxLuggage: 8, perKm: 1.4, minFare: 50 },
  { key: 'minibus', label: L('Minibus', 'Minibus', 'Kleinbus', 'Minibus', 'Microbús'), minPassengers: 9, maxPassengers: 20, maxLuggage: 20, perKm: 1.8, minFare: 70 },
  { key: 'vip', label: L('VIP vehicle', 'Véhicule VIP', 'VIP-Fahrzeug', 'Veicolo VIP', 'Vehículo VIP'), minPassengers: 1, maxPassengers: 4, maxLuggage: 4, perKm: 1.6, minFare: 60, onRequest: true },
];

const ROUTE_ENFIDHA_SOUSSE = {
  fromZone: 'enfidha-airport', toZone: 'sousse', published: true,
  slug: L('enfidha-airport-sousse-transfer', 'transfert-aeroport-enfidha-sousse', 'transfer-flughafen-enfidha-sousse', 'trasferimento-aeroporto-enfidha-sousse', 'traslado-aeropuerto-enfidha-susa'),
  title: L('Enfidha Airport – Sousse transfer', 'Transfert aéroport Enfidha – Sousse', 'Transfer Flughafen Enfidha – Sousse', 'Trasferimento aeroporto Enfidha – Sousse', 'Traslado aeropuerto Enfidha – Susa'),
  description: L('Private transfer with flight tracking and meet & greet.', 'Transfert privé avec suivi de vol et accueil personnalisé.', 'Privater Transfer mit Flugverfolgung und persönlichem Empfang.', 'Trasferimento privato con monitoraggio del volo e accoglienza personalizzata.', 'Traslado privado con seguimiento del vuelo y recibimiento personalizado.'),
};

const EXCURSIONS = [
  {
    slug: L('carthage-sidi-bou-said-private-tour', 'excursion-carthage-sidi-bou-said', 'privatausflug-karthago-sidi-bou-said', 'escursione-privata-cartagine-sidi-bou-said', 'excursion-privada-cartago-sidi-bou-said'),
    title: L('Carthage & Sidi Bou Said private tour', 'Carthage & Sidi Bou Saïd', 'Privatausflug Karthago & Sidi Bou Saïd', 'Escursione privata Cartagine e Sidi Bou Saïd', 'Excursión privada Cartago y Sidi Bou Saïd'),
    summary: L('Roman ruins, Punic ports and the blue-and-white village overlooking the bay of Tunis.', 'Ruines romaines, ports puniques et le village blanc et bleu qui domine la baie de Tunis.', 'Römische Ruinen, punische Häfen und das blau-weiße Dorf über der Bucht von Tunis.', 'Rovine romane, porti punici e il villaggio bianco e blu che domina la baia di Tunisi.', 'Ruinas romanas, puertos púnicos y el pueblo blanco y azul que domina la bahía de Túnez.'),
    description: L('[Detailed description — 300 words recommended for SEO]', '[Description détaillée — 300 mots conseillés pour le référencement]', '[Ausführliche Beschreibung — 300 Wörter für SEO empfohlen]', '[Descrizione dettagliata — 300 parole consigliate per la SEO]', '[Descripción detallada — se recomiendan 300 palabras para el SEO]'),
    highlights: [
      L('Antonine Baths', 'Thermes d’Antonin', 'Antoninus-Thermen', 'Terme di Antonino', 'Termas de Antonino'),
      L('Punic ports', 'Ports puniques', 'Punische Häfen', 'Porti punici', 'Puertos púnicos'),
      L('Café des Délices view', 'Vue du Café des Délices', 'Aussicht vom Café des Délices', 'Vista dal Café des Délices', 'Vistas desde el Café des Délices'),
    ],
    included: [
      L('Private air-conditioned vehicle', 'Véhicule privé climatisé', 'Privates klimatisiertes Fahrzeug', 'Veicolo privato climatizzato', 'Vehículo privado con aire acondicionado'),
      HOTEL_PICKUP,
      L('Mini photo session', 'Mini séance photo', 'Mini-Fotoshooting', 'Mini servizio fotografico', 'Mini sesión de fotos'),
      L('Personal advice', 'Conseils personnalisés', 'Persönliche Beratung', 'Consigli personalizzati', 'Consejos personalizados'),
    ],
    notIncluded: [
      L('Site entrance fees', 'Entrées des sites', 'Eintrittsgelder', 'Biglietti d’ingresso ai siti', 'Entradas a los sitios'),
      L('Lunch (optional)', 'Déjeuner (en option)', 'Mittagessen (optional)', 'Pranzo (facoltativo)', 'Almuerzo (opcional)'),
    ],
    toBring: [
      L('Comfortable shoes', 'Chaussures confortables', 'Bequeme Schuhe', 'Scarpe comode', 'Calzado cómodo'),
      L('Sun hat', 'Chapeau', 'Sonnenhut', 'Cappello', 'Sombrero'),
    ],
    program: [
      { time: '08:00', text: HOTEL_PICKUP },
      { time: '10:00', text: L('Carthage archaeological sites', 'Sites archéologiques de Carthage', 'Archäologische Stätten von Karthago', 'Siti archeologici di Cartagine', 'Yacimientos arqueológicos de Cartago') },
      { time: '13:00', text: L('Lunch (optional)', 'Déjeuner (option)', 'Mittagessen (optional)', 'Pranzo (facoltativo)', 'Almuerzo (opcional)') },
      { time: '14:30', text: L('Sidi Bou Said', 'Sidi Bou Saïd', 'Sidi Bou Saïd', 'Sidi Bou Saïd', 'Sidi Bou Saïd') },
      { time: '18:00', text: L('Return to hotel', 'Retour à l’hôtel', 'Rückkehr zum Hotel', 'Rientro in hotel', 'Regreso al hotel') },
    ],
    durationLabel: FULL_DAY, durationHours: 10,
    category: 'culture', departureCities: ['Sousse', 'Hammamet', 'Monastir', 'Tunis'], guideLanguages: ['fr', 'en', 'de', 'it', 'es'],
    badges: ['private', 'bestseller'], startTimes: ['08:00'],
    images: [
      { url: 'https://images.unsplash.com/photo-1770712857881-2133f72fcab7?auto=format&fit=crop&q=75&w=1600', alt: L('Ancient ruins of Carthage by the sea, private tour', 'Ruines antiques de Carthage face à la mer, excursion privée', 'Antike Ruinen von Karthago am Meer, Privatausflug', 'Rovine antiche di Cartagine sul mare, escursione privata', 'Ruinas antiguas de Cartago junto al mar, excursión privada') },
      { url: 'https://images.unsplash.com/photo-1723579632461-3ba5840fa422?auto=format&fit=crop&q=75&w=1600', alt: L('White and blue lane in Sidi Bou Said', 'Ruelle blanche et bleue de Sidi Bou Saïd', 'Weiß-blaue Gasse in Sidi Bou Saïd', 'Vicolo bianco e blu a Sidi Bou Saïd', 'Callejuela blanca y azul en Sidi Bou Saïd') },
      { url: 'https://images.unsplash.com/photo-1726428977596-b5baddb42274?auto=format&fit=crop&q=75&w=1600', alt: L('Minaret in Sidi Bou Said', 'Minaret de Sidi Bou Saïd', 'Minarett in Sidi Bou Saïd', 'Minareto a Sidi Bou Saïd', 'Minarete de Sidi Bou Saïd') },
    ],
    pricing: {
      mode: 'minimum',
      seasons: { low: { minimum: 200, adult: 50 }, mid: { minimum: 220, adult: 55 }, high: { minimum: 240, adult: 60 } },
      childDiscount: 0, infantDiscount: 0, maxGroup: 8, zones: zonesPickup,
      guideLanguages: [{ lang: 'de', fee: 0 }, { lang: 'it', fee: 0 }],
      options: [lunch, photo],
    },
    availability: { mode: 'request', capacityPerDay: 3, minNoticeHours: 24 },
    seo: seo({
      en: ['carthage sidi bou said private tour', 'Carthage & Sidi Bou Said private tour from your hotel', 'Private Carthage and Sidi Bou Said tour solo or in a group, hotel pick-up, free cancellation 24 h before. Pay on site. Book your day now.', 'Private tour of Carthage and Sidi Bou Said'],
      fr: ['excursion carthage sidi bou said', 'Excursion Carthage et Sidi Bou Saïd privée depuis votre hôtel', 'Excursion privée Carthage et Sidi Bou Saïd seule ou en groupe, prise en charge à l’hôtel, annulation gratuite 24 h. Paiement sur place. Réservez.', 'Excursion privée à Carthage et Sidi Bou Saïd'],
      de: ['ausflug karthago sidi bou said', 'Privatausflug Karthago & Sidi Bou Saïd ab Ihrem Hotel', 'Privatausflug nach Karthago und Sidi Bou Saïd allein oder in der Gruppe, Abholung am Hotel, kostenlose Stornierung bis 24 Std. Zahlung vor Ort.', 'Privatausflug nach Karthago und Sidi Bou Saïd'],
      it: ['escursione cartagine sidi bou said', 'Escursione privata Cartagine e Sidi Bou Saïd dal tuo hotel', 'Escursione privata a Cartagine e Sidi Bou Saïd da soli o in gruppo, ritiro in hotel, cancellazione gratuita 24 h. Pagamento sul posto.', 'Escursione privata a Cartagine e Sidi Bou Saïd'],
      es: ['excursion cartago sidi bou said', 'Excursión privada a Cartago y Sidi Bou Saïd desde tu hotel', 'Excursión privada a Cartago y Sidi Bou Saïd solo o en grupo, recogida en el hotel, cancelación gratuita 24 h. Pago en destino.', 'Excursión privada a Cartago y Sidi Bou Saïd'],
    }),
    popularity: 100,
  },
  {
    slug: L('sahara-2-days-private-tour', 'sahara-2-jours', 'sahara-2-tage-privatausflug', 'sahara-2-giorni-escursione-privata', 'sahara-2-dias-excursion-privada'),
    title: L('Sahara in 2 days', 'Sahara en 2 jours', 'Sahara in 2 Tagen', 'Sahara in 2 giorni', 'Sáhara en 2 días'),
    summary: L('El Jem, Matmata, Douz dunes and a night in a desert camp.', 'El Jem, Matmata, les dunes de Douz et une nuit en campement.', 'El Jem, Matmata, die Dünen von Douz und eine Nacht im Wüstencamp.', 'El Jem, Matmata, le dune di Douz e una notte in un campo tendato nel deserto.', 'El Jem, Matmata, las dunas de Douz y una noche en un campamento en el desierto.'),
    description: L('[Detailed description]', '[Description détaillée]', '[Ausführliche Beschreibung]', '[Descrizione dettagliata]', '[Descripción detallada]'),
    included: [
      L('Private 4×4 or minivan', '4×4 ou minivan privé', 'Privater 4×4 oder Minivan', '4×4 o minivan privato', '4×4 o monovolumen privado'),
      L('Desert camp night with dinner', 'Nuit en campement avec dîner', 'Übernachtung im Wüstencamp mit Abendessen', 'Notte in campo tendato con cena', 'Noche en campamento con cena'),
      HOTEL_PICKUP,
    ],
    notIncluded: [L('Camel ride (optional)', 'Balade à dromadaire (option)', 'Kamelritt (optional)', 'Giro in dromedario (facoltativo)', 'Paseo en dromedario (opcional)')],
    durationLabel: L('2 days', '2 jours', '2 Tage', '2 giorni', '2 días'), durationHours: 36, category: 'desert',
    departureCities: ['Sousse', 'Monastir', 'Mahdia', 'Hammamet'], guideLanguages: ['fr', 'en', 'de'], badges: ['private'],
    images: [
      { url: 'https://images.unsplash.com/photo-1487060582949-8a4ea9710d16?auto=format&fit=crop&q=75&w=1600', alt: L('Sahara dunes at Ksar Ghilane, 2-day tour', 'Dunes du Sahara à Ksar Ghilane, excursion 2 jours', 'Sahara-Dünen bei Ksar Ghilane, 2-Tages-Ausflug', 'Dune del Sahara a Ksar Ghilane, escursione di 2 giorni', 'Dunas del Sáhara en Ksar Ghilane, excursión de 2 días') },
      { url: 'https://images.unsplash.com/photo-1702400558189-b45379744432?auto=format&fit=crop&q=75&w=1600', alt: L('Traveller on a Sahara dune', 'Voyageur sur une dune du Sahara', 'Reisender auf einer Sahara-Düne', 'Viaggiatore su una duna del Sahara', 'Viajero sobre una duna del Sáhara') },
      { url: 'https://images.unsplash.com/photo-1568387380357-ba90334a6541?auto=format&fit=crop&q=75&w=1600', alt: L('Camel in the Tunisian desert', 'Dromadaire dans le désert tunisien', 'Dromedar in der tunesischen Wüste', 'Dromedario nel deserto tunisino', 'Dromedario en el desierto tunecino') },
    ],
    pricing: {
      mode: 'minimum',
      seasons: { low: { minimum: 480, adult: 120 }, mid: { minimum: 520, adult: 130 }, high: { minimum: 560, adult: 140 } }, // EXEMPLES
      childDiscount: 0, infantDiscount: 0, maxGroup: 8, zones: zonesPickup,
      options: [
        { key: 'camel', label: L('Camel ride at sunset', 'Dromadaire au coucher du soleil', 'Kamelritt bei Sonnenuntergang', 'Dromedario al tramonto', 'Dromedario al atardecer'), price: 20, per: 'person' },
        { key: 'quad', label: L('Quad in the dunes', 'Quad dans les dunes', 'Quad in den Dünen', 'Quad tra le dune', 'Quad en las dunas'), price: 45, per: 'person' },
      ],
    },
    availability: { mode: 'request', capacityPerDay: 2, minNoticeHours: 48 },
    seo: seo({
      en: ['sahara 2 days tour from sousse', 'Sahara 2 days private tour from Sousse | Douz camp', 'Private 2-day Sahara tour from Sousse: El Jem, Matmata, Douz dunes and a night in a desert camp. solo or in a group, pay on site. Book now.', 'Sahara in 2 days, private tour'],
      fr: ['excursion sahara depuis sousse', 'Excursion Sahara 2 jours privée depuis Sousse | Douz', 'Excursion privée Sahara 2 jours depuis Sousse : El Jem, Matmata, dunes de Douz et nuit en campement. seule ou en groupe, paiement sur place.', 'Sahara en 2 jours, excursion privée'],
      de: ['sahara ausflug 2 tage ab sousse', 'Sahara 2 Tage Privatausflug ab Sousse | Camp in Douz', 'Privater 2-Tages-Ausflug in die Sahara ab Sousse: El Jem, Matmata, Dünen von Douz und Nacht im Camp. allein oder in der Gruppe, Zahlung vor Ort.', 'Sahara in 2 Tagen, Privatausflug'],
      it: ['escursione sahara 2 giorni da sousse', 'Sahara 2 giorni escursione privata da Sousse | Douz', 'Escursione privata di 2 giorni nel Sahara da Sousse: El Jem, Matmata, dune di Douz e notte al campo. Da soli o in gruppo, pagamento sul posto.', 'Sahara in 2 giorni, escursione privata'],
      es: ['excursion sahara 2 dias desde susa', 'Sáhara 2 días excursión privada desde Susa | Douz', 'Excursión privada de 2 días al Sáhara desde Susa: El Jem, Matmata, dunas de Douz y noche en campamento. Solo o en grupo, pago en destino.', 'Sáhara en 2 días, excursión privada'],
    }),
    popularity: 90,
  },
  {
    slug: L('el-jem-kairouan-tour', 'excursion-el-jem-kairouan', 'ausflug-el-jem-kairouan', 'escursione-el-jem-kairouan', 'excursion-el-jem-kairuan'),
    title: L('El Jem & Kairouan', 'El Jem & Kairouan', 'El Jem & Kairouan', 'El Jem e Kairouan', 'El Jem y Kairuán'),
    summary: L('The Roman amphitheatre of El Jem and the holy city of Kairouan.', 'L’amphithéâtre romain d’El Jem et la ville sainte de Kairouan.', 'Das römische Amphitheater von El Jem und die heilige Stadt Kairouan.', 'L’anfiteatro romano di El Jem e la città santa di Kairouan.', 'El anfiteatro romano de El Jem y la ciudad santa de Kairuán.'),
    description: L('[Detailed description]', '[Description détaillée]', '[Ausführliche Beschreibung]', '[Descrizione dettagliata]', '[Descripción detallada]'),
    durationLabel: FULL_DAY, durationHours: 9, category: 'culture',
    departureCities: ['Sousse', 'Monastir', 'Mahdia'], guideLanguages: ['fr', 'en', 'it'], badges: ['private', 'family'],
    images: [
      { url: 'https://images.unsplash.com/photo-1755463083594-8cd2d1e2135e?auto=format&fit=crop&q=75&w=1600', alt: L('El Jem Roman amphitheatre, Kairouan tour', 'Amphithéâtre romain d’El Jem, excursion El Jem et Kairouan', 'Römisches Amphitheater von El Jem, Ausflug nach Kairouan', 'Anfiteatro romano di El Jem, escursione a Kairouan', 'Anfiteatro romano de El Jem, excursión a Kairuán') },
      { url: 'https://images.unsplash.com/photo-1568632054492-c5398a6d5405?auto=format&fit=crop&q=75&w=1600', alt: L('Medina of Sousse', 'Médina de Sousse', 'Medina von Sousse', 'Medina di Sousse', 'Medina de Susa') },
      { url: 'https://images.unsplash.com/photo-1620509400919-a2ef8294f239?auto=format&fit=crop&q=75&w=1600', alt: L('Palm tree and mountain in Tunisia', 'Palmier et montagne en Tunisie', 'Palme und Berg in Tunesien', 'Palma e montagna in Tunisia', 'Palmera y montaña en Túnez') },
    ],
    pricing: {
      mode: 'minimum',
      seasons: { low: { minimum: 180, adult: 45 }, mid: { minimum: 200, adult: 50 }, high: { minimum: 220, adult: 55 } }, // EXEMPLES
      childDiscount: 0, infantDiscount: 0, maxGroup: 8, zones: zonesPickup, options: [lunch],
    },
    availability: { mode: 'instant', capacityPerDay: 3 },
    seo: seo({
      en: ['el jem kairouan tour', 'El Jem and Kairouan private day tour from Sousse', 'Private day tour to the El Jem amphitheatre and Kairouan from Sousse or Monastir, solo or in a group, hotel pick-up, pay on site. Book your day.', 'El Jem and Kairouan private tour'],
      fr: ['excursion el jem kairouan', 'Excursion El Jem et Kairouan privée depuis Sousse', 'Excursion privée à l’amphithéâtre d’El Jem et Kairouan depuis Sousse ou Monastir, seule ou en groupe, prise en charge à l’hôtel, paiement sur place.', 'Excursion privée El Jem et Kairouan'],
      de: ['ausflug el jem kairouan', 'Privater Tagesausflug El Jem und Kairouan ab Sousse', 'Privater Tagesausflug zum Amphitheater von El Jem und nach Kairouan ab Sousse oder Monastir, allein oder in der Gruppe, Abholung am Hotel, Zahlung vor Ort.', 'Privatausflug El Jem und Kairouan'],
      it: ['escursione el jem kairouan', 'Escursione privata El Jem e Kairouan da Sousse', 'Escursione privata all’anfiteatro di El Jem e a Kairouan da Sousse o Monastir, da soli o in gruppo, ritiro in hotel, pagamento sul posto.', 'Escursione privata El Jem e Kairouan'],
      es: ['excursion el jem kairuan', 'Excursión privada a El Jem y Kairuán desde Susa', 'Excursión privada al anfiteatro de El Jem y a Kairuán desde Susa o Monastir, solo o en grupo, recogida en el hotel, pago en destino.', 'Excursión privada a El Jem y Kairuán'],
    }),
    popularity: 70,
  },
];

/* =============================== Mise à niveau des traductions =============================== */

const isL = (v) => v && typeof v === 'object' && !Array.isArray(v) && 'en' in v;
/** Complète les langues vides d'un champ traduit sans écraser ce qui a été saisi dans l'admin */
function fillL(target, src) {
  const out = { ...(target || {}) };
  let changed = false;
  for (const l of LANGS) if (!out[l] && src[l]) { out[l] = src[l]; changed = true; }
  return [out, changed];
}
/** Tableaux de champs traduits : complète l'élément i seulement si son texte anglais est inchangé */
function fillArr(target = [], src = [], get = (x) => x, set = (x, v) => v) {
  let changed = false;
  const out = target.map((item, i) => {
    const s = src[i];
    const cur = get(item);
    if (!s || !isL(cur) || cur.en !== get(s).en) return item;
    const [v, c] = fillL(cur, get(s));
    if (c) changed = true;
    return set(item, v);
  });
  return [out, changed];
}

async function upgradeExcursions(log) {
  for (const src of EXCURSIONS) {
    const e = await Excursion.findOne({ 'slug.en': src.slug.en }).lean();
    if (!e) continue;
    const $set = {};
    for (const k of ['slug', 'title', 'summary', 'description', 'durationLabel']) {
      const [v, c] = fillL(e[k], src[k]); if (c) $set[k] = v;
    }
    for (const k of ['highlights', 'included', 'notIncluded', 'toBring']) {
      const [v, c] = fillArr(e[k], src[k]); if (c) $set[k] = v;
    }
    let [v, c] = fillArr(e.program, src.program, (x) => x.text, (x, t) => ({ ...x, text: t })); if (c) $set.program = v;
    [v, c] = fillArr(e.images, src.images, (x) => x.alt, (x, a) => ({ ...x, alt: a })); if (c) $set.images = v;
    [v, c] = fillArr(e.pricing?.options, src.pricing.options, (x) => x.label, (x, lab) => ({ ...x, label: lab })); if (c) $set['pricing.options'] = v;
    for (const l of OTHER) {
      if (!e.seo?.[l]?.metaTitle) $set[`seo.${l}`] = src.seo[l];
      if (!e.translation || e.translation[l] === 'missing') $set[`translation.${l}`] = 'auto';
    }
    const langs = [...new Set([...(e.publishedLangs || []), ...LANGS])];
    if (langs.length !== (e.publishedLangs || []).length) $set.publishedLangs = langs;
    if (Object.keys($set).length) {
      await Excursion.updateOne({ _id: e._id }, { $set });
      log(`Traductions complétées : ${src.title.fr}`);
    }
  }
}

async function upgradeSettings(s) {
  const $set = {};
  const [faq, c1] = fillArr(s.faq, SETTINGS_FAQ, (x) => x.q, (x, q) => ({ ...x, q }));
  const [faq2, c2] = fillArr(faq, SETTINGS_FAQ, (x) => x.a, (x, a) => ({ ...x, a }));
  if (c1 || c2) $set.faq = faq2;
  for (const k of Object.keys(SETTINGS_LEGAL)) {
    const cur = s.legal?.[k];
    if (cur && cur.en !== SETTINGS_LEGAL[k].en) continue; // texte personnalisé : on n'y touche pas
    const [v, c] = fillL(cur, SETTINGS_LEGAL[k]); if (c) $set[`legal.${k}`] = v;
  }
  if (Object.keys($set).length) await Settings.updateOne({ _id: s._id }, { $set });
}

/* =============================== Remplissage =============================== */

/**
 * create = false : ne crée aucun contenu, complète seulement les traductions vides (utilisé à chaque démarrage).
 */
export async function runSeed({ reset = false, create = true, log = console.log } = {}) {
  if (reset) {
    await mongoose.connection.dropDatabase();
    log('Base vidée.');
  }

  await ensureAdmin({ log });

  // ----- Paramètres -----
  const s = await Settings.findOne().lean();
  if (!s && create) {
    await Settings.create({
      calendar: {
        seasons: [
          { name: 'high', from: '07-01', to: '08-31' },
          { name: 'mid', from: '04-01', to: '06-30' }, { name: 'mid', from: '09-01', to: '10-31' },
          { name: 'low', from: '11-01', to: '03-31' },
        ],
        holidays: [], blocked: [],
      },
      earlyBooking: { daysBefore: 30, percent: 5 },
      fx: { mode: 'auto', USD: 1.08, GBP: 0.85, TND: 3.4 },
      contact: { phone: '[TÉLÉPHONE]', whatsapp: '[NUMÉRO WHATSAPP]', email: '[E-MAIL]', address: '[ADRESSE]' },
      social: { tripadvisor: '', facebook: '', instagram: '', tiktok: '', googleReviews: '' },
      cancellationHours: 24,
      faq: SETTINGS_FAQ,
      legal: SETTINGS_LEGAL,
    });
    log('Paramètres créés.');
  } else if (s) await upgradeSettings(s);

  // ----- Zones et lieux de transfert (libellés complétés dans les 5 langues) -----
  for (const [key, label] of ZONES) {
    const z = await Zone.findOne({ key }).lean();
    if (!z) { if (create) await Zone.create({ key, label }); }
    else { const [v, c] = fillL(z.label, label); if (c) await Zone.updateOne({ key }, { $set: { label: v } }); }
  }
  for (const [name, type, zone, label] of PLACES) {
    const p = await Location.findOne({ name }).lean();
    if (!p) { if (create) await Location.create({ name, type, zone, label }); }
    else { const [v, c] = fillL(p.label, label); if (c) await Location.updateOne({ _id: p._id }, { $set: { label: v } }); }
  }

  const cfg = await TransferConfig.findOne().lean();
  if (!cfg && create) {
    // Capacités du §4.3 ; prix = EXEMPLES à remplacer
    const base = { // prix berline d'exemple par couple de zones
      'enfidha-airport|sousse': 35, 'enfidha-airport|hammamet': 35, 'enfidha-airport|monastir': 50, 'enfidha-airport|mahdia': 70, 'enfidha-airport|tunis': 80,
      'monastir-airport|sousse': 25, 'monastir-airport|monastir': 15, 'monastir-airport|mahdia': 40, 'monastir-airport|hammamet': 60,
      'tunis-airport|tunis': 20, 'tunis-airport|hammamet': 60, 'tunis-airport|sousse': 110,
      'djerba-airport|djerba': 25, 'sousse|tunis': 110, 'sousse|hammamet': 60,
    };
    const factor = { sedan: 1, minivan: 1.4, van: 1.7, minibus: 2.4, vip: 1.8 };
    const grid = [];
    for (const [k, price] of Object.entries(base)) {
      const [fromZone, toZone] = k.split('|');
      for (const v of VEHICLES) grid.push({ fromZone, toZone, vehicle: v.key, price: Math.round(price * factor[v.key]) });
    }
    await TransferConfig.create({ vehicles: VEHICLES, grid, returnDiscount: 10, minNoticeHours: 12, hourlyHire: { pricePerHour: 25, pricePerDay: 150 } });
    log('Transferts créés (prix d’exemple).');
  } else if (cfg) {
    let changed = false;
    const vehicles = (cfg.vehicles || []).map((v) => {
      const src = VEHICLES.find((x) => x.key === v.key);
      if (!src) return v;
      const [label, c] = fillL(v.label, src.label); if (c) changed = true;
      // Règle des tranches de passagers (berline 1–4, VIP 1–4 sur demande, minivan 5–8, minibus 9+) : appliquée une seule fois
      if (v.minPassengers == null) {
        changed = true;
        return { ...v, label, minPassengers: src.minPassengers, maxPassengers: src.maxPassengers, maxLuggage: src.maxLuggage, onRequest: !!src.onRequest };
      }
      return { ...v, label };
    });
    // Nouvelle répartition (une seule fois) : minivan 5–6, van 7–8 (prix repris du minivan, à ajuster), minibus 9+
    let grid = cfg.grid || [];
    const mv = vehicles.find((v) => v.key === 'minivan');
    if (mv && !vehicles.some((v) => v.key === 'van')) {
      changed = true;
      Object.assign(mv, { minPassengers: 5, maxPassengers: 6, maxLuggage: Math.min(mv.maxLuggage || 6, 6) });
      const van = VEHICLES.find((v) => v.key === 'van');
      vehicles.splice(vehicles.indexOf(mv) + 1, 0, { ...van, perKm: mv.perKm ?? van.perKm, minFare: mv.minFare ?? van.minFare });
      grid = [...grid, ...grid.filter((g) => g.vehicle === 'minivan').map((g) => ({ ...g, vehicle: 'van' }))];
      const mb = vehicles.find((v) => v.key === 'minibus');
      if (mb) mb.minPassengers = 9;
    }
    if (changed) await TransferConfig.updateOne({ _id: cfg._id }, { $set: { vehicles, grid } });
  }

  const route = await TransferRoute.findOne({ fromZone: ROUTE_ENFIDHA_SOUSSE.fromZone, toZone: ROUTE_ENFIDHA_SOUSSE.toZone }).lean();
  if (!route) { if (create) await TransferRoute.create(ROUTE_ENFIDHA_SOUSSE); }
  else {
    const $set = {};
    for (const k of ['slug', 'title', 'description']) { const [v, c] = fillL(route[k], ROUTE_ENFIDHA_SOUSSE[k]); if (c) $set[k] = v; }
    if (Object.keys($set).length) await TransferRoute.updateOne({ _id: route._id }, { $set });
  }

  // ----- Excursions -----
  if (create && (await Excursion.countDocuments()) === 0) {
    await Excursion.create(EXCURSIONS.map((e) => ({ ...e, translation: T, published: true, publishedLangs: [...LANGS] })));
    log(`${EXCURSIONS.length} excursions créées (5 langues).`);
  } else await upgradeExcursions(log);

  if (create && !(await Promo.findOne({ code: 'BIENVENUE' }))) await Promo.create({ code: 'BIENVENUE', percent: 10 });
  if (create) log('Données de démarrage prêtes.');
}

/** Au démarrage du serveur : admin toujours garanti ; contenu de démonstration seulement si la base est vide. */
export async function bootstrap({ log = console.log } = {}) {
  const empty = !(await Settings.exists({})) && !(await Excursion.exists({}));
  if (empty && String(process.env.AUTO_SEED ?? 'true').toLowerCase() !== 'false') {
    log('[seed] base vide : création des données de démarrage…');
    await runSeed({ log });
  } else {
    // Admin garanti + traductions manquantes complétées (rien n'est écrasé ni recréé)
    await runSeed({ create: false, log });
  }
}
