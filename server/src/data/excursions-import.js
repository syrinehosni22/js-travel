/**
 * Excursions et circuits à importer (textes originaux JS Travel, en français).
 * Les itinéraires s'inspirent des parcours classiques de Tunisie ; les autres langues
 * sont traduites automatiquement par le script d'import.
 *
 * Chaque fiche est créée en BROUILLON, sans prix (« sur devis ») : ajoutez vos tarifs
 * et vos photos dans l'admin avant de publier.
 */

// Photos de la photothèque du site (Unsplash, déjà utilisées sur le site)
const IMG = {
  saharaDune: 'https://images.unsplash.com/photo-1702400558189-b45379744432',
  ksarGhilane: 'https://images.unsplash.com/photo-1487060582949-8a4ea9710d16',
  camel: 'https://images.unsplash.com/photo-1568387380357-ba90334a6541',
  southPalm: 'https://images.unsplash.com/photo-1620509400919-a2ef8294f239',
  elJem: 'https://images.unsplash.com/photo-1755463083594-8cd2d1e2135e',
  carthage: 'https://images.unsplash.com/photo-1770712857881-2133f72fcab7',
  sidiBouSaidStreet: 'https://images.unsplash.com/photo-1723579632461-3ba5840fa422',
  sidiBouSaidSea: 'https://images.unsplash.com/photo-1607869861980-da5f9b8b4969',
  sousseMedina: 'https://images.unsplash.com/photo-1568632054492-c5398a6d5405',
  mahdia: 'https://images.unsplash.com/photo-1621340677732-65bb864b57ec',
};
const img = (key, alt) => ({ url: IMG[key], alt });

// Étapes de la carte (coordonnées approximatives des sites)
const P = {
  tunisMedina: ['Médina de Tunis', 36.7986, 10.1706], bardo: ['Musée du Bardo', 36.8095, 10.1342],
  carthage: ['Carthage, thermes d’Antonin', 36.853, 10.333], sidiBouSaid: ['Sidi Bou Saïd', 36.8705, 10.3417],
  tunisAirport: ['Aéroport Tunis-Carthage', 36.851, 10.2272], elJem: ['Amphithéâtre d’El Jem', 35.2964, 10.7069],
  matmata: ['Matmata', 33.5444, 9.9681], douz: ['Douz', 33.4566, 9.0203], chott: ['Chott el-Jérid', 33.8, 8.55],
  ksarGhilane: ['Ksar Ghilane', 32.9886, 9.6375], ouledSoltane: ['Ksar Ouled Soltane', 32.7883, 10.5136],
  tataouine: ['Tataouine', 32.9297, 10.4518], chenini: ['Chenini', 32.9119, 10.2617], gabes: ['Gabès, marché de Jara', 33.8869, 10.0975],
  kairouan: ['Kairouan, Grande Mosquée', 35.6814, 10.1036], monastir: ['Ribat de Monastir', 35.7778, 10.8306],
  sousse: ['Médina de Sousse', 35.8256, 10.637], kantaoui: ['Port El Kantaoui', 35.892, 10.598],
  hammamet: ['Médina de Hammamet', 36.4, 10.6167], nabeul: ['Nabeul', 36.4561, 10.7376], kelibia: ['Fort de Kélibia', 36.8476, 11.106],
  kerkouane: ['Kerkouane', 36.9465, 11.0996], haouaria: ['El Haouaria', 37.0532, 11.0083], korbous: ['Korbous', 36.8236, 10.5703],
  zaghouan: ['Temple des Eaux, Zaghouan', 36.396, 10.1385], thuburbo: ['Thuburbo Majus', 36.4003, 9.9036], dougga: ['Dougga', 36.4219, 9.22],
  bullaRegia: ['Bulla Regia', 36.5583, 8.7556], testour: ['Testour', 36.5513, 9.443], utique: ['Utique', 37.056, 10.061],
  bizerte: ['Vieux port de Bizerte', 37.2744, 9.8739], tabarka: ['Tabarka', 36.9544, 8.758], kef: ['Le Kef', 36.1822, 8.7148],
  oudhna: ['Oudhna', 36.6233, 10.1631], tozeur: ['Tozeur', 33.9197, 8.1335], chebika: ['Chebika', 34.3194, 7.9389],
  tamerza: ['Tamerza', 34.3903, 7.9433], mides: ['Midès', 34.4033, 7.9081], friguia: ['Friguia Park', 36.129, 10.4086],
};
const stops = (...keys) => keys.map((k) => (Array.isArray(k) ? k : P[k])).map(([name, lat, lng, note = '']) => ({ name, note, lat, lng }));

const DAY_TRIP_CITIES = ['Sousse', 'Hammamet', 'Monastir', 'Tunis'];
const GOOD_SHOES = 'Chaussures fermées et confortables';
const SUN = 'Chapeau, lunettes de soleil et crème solaire';

export const EXCURSIONS = [
  /* ============================ CIRCUITS ============================ */
  {
    title: 'Circuit désert 4 jours : Douz, Ksar Ghilane et Chenini',
    category: 'desert', durationLabel: '4 jours / 3 nuits', durationHours: 96, departureCities: ['Tunis'],
    summary: 'Quatre jours en 4x4 privé pour traverser le Sud tunisien : El Jem, Matmata, les dunes de Douz, une nuit au campement de Ksar Ghilane et les ksour de Tataouine.',
    description: `Ce circuit désert 4 jours, privé et en 4x4, vous emmène du Nord au cœur du Sahara, à votre rythme et avec votre chauffeur. Le premier jour, vous quittez Tunis tôt le matin pour l’amphithéâtre romain d’El Jem, l’un des mieux conservés au monde, avant de rejoindre Matmata et ses maisons troglodytes creusées dans la roche. La journée se termine à Douz, la porte du désert, où une balade à dromadaire au coucher du soleil est possible.

Le deuxième jour, la route traverse le Chott el-Jérid, immense lac salé aux reflets changeants, puis la piste mène à l’oasis de Ksar Ghilane. Après une baignade dans la source d’eau chaude, vous passez la nuit au campement, sous les étoiles, après un dîner sous la tente.

Le troisième jour est consacré au pays des ksour : greniers fortifiés de Ksar Ouled Soltane, paysages de Tataouine et village berbère perché de Chenini. Le dernier jour, vous faites une halte au marché aux épices et au henné de Gabès avant de remonter vers Tunis.

Ce voyage convient aux couples, aux familles et aux groupes d’amis qui veulent découvrir le Sud sans contrainte de groupe. Le programme peut être adapté : dites-nous vos envies au moment de la demande.`,
    more: `Bon à savoir : les nuits se passent en hôtels confortables ou en maison d’hôtes typique, et une nuit au campement de Ksar Ghilane, sous la tente berbère. Les trajets en 4x4 sont longs mais ponctués d’arrêts photo et de pauses café. Les activités dans les dunes (dromadaire à Douz, quad, cheval ou buggy à Ksar Ghilane) se réservent sur place selon vos envies. La saison idéale va d’octobre à mai ; en hiver, prévoyez une veste chaude car les nuits sahariennes sont fraîches. Vous réglez sur place, sans acompte, et nous confirmons votre programme détaillé après votre demande. Envoyez-nous votre demande : nous vous répondons rapidement par e-mail ou par WhatsApp.`,
    related: ['circuit-sud-tunisien-2-jours', 'circuit-tunisie-8-jours'],
    highlights: ['Une nuit en campement saharien à Ksar Ghilane', 'Baignade dans la source chaude de l’oasis', 'Maisons troglodytes de Matmata', 'Ksour de Tataouine et village perché de Chenini', 'Circuit privé en 4x4 avec chauffeur'],
    included: ['Transport en 4x4 privé avec chauffeur', 'Prise en charge à Tunis et retour', 'Hébergement 3 nuits, dont une nuit en campement', 'Dîner sous la tente à Ksar Ghilane'],
    notIncluded: ['Entrées des sites et musées', 'Repas non mentionnés', 'Activités en option : dromadaire, quad, cheval, buggy', 'Pourboires'],
    toBring: ['Veste ou polaire pour les nuits fraîches', 'Chèche ou foulard', SUN, GOOD_SHOES, 'Maillot de bain et serviette'],
    program: [
      ['Jour 1', 'Tunis – El Jem – Matmata – Douz : amphithéâtre d’El Jem, maisons troglodytes de Matmata, arrivée à Douz et coucher de soleil sur les dunes.'],
      ['Jour 2', 'Douz – Chott el-Jérid – Ksar Ghilane : traversée du lac salé, baignade dans la source chaude, nuit au campement.'],
      ['Jour 3', 'Ksar Ghilane – Tataouine – Chenini : ksour de Ksar Ouled Soltane, déjeuner typique, village berbère de Chenini.'],
      ['Jour 4', 'Tataouine – Gabès – Tunis : marché aux épices et au henné de Jara, route du retour vers Tunis.'],
    ],
    faq: [
      ['Quelle est la meilleure saison ?', 'D’octobre à mai. En été, la chaleur est très forte dans le Sud ; en hiver, les nuits au désert sont froides.'],
      ['Le circuit convient-il aux enfants ?', 'Oui, s’ils supportent les longs trajets en voiture. Indiquez leur âge pour prévoir des sièges adaptés.'],
    ],
    images: [img('ksarGhilane', 'Circuit désert 4 jours : dunes de Ksar Ghilane'), img('camel', 'Dromadaire dans le désert près de Tataouine')],
    stops: stops('tunisMedina', 'elJem', 'matmata', 'douz', 'chott', 'ksarGhilane', 'ouledSoltane', 'chenini', 'gabes', 'tunisMedina'),
    seo: {
      focusKeyword: 'circuit désert 4 jours',
      metaTitle: 'Circuit désert 4 jours en Tunisie : Douz et Ksar Ghilane',
      metaDescription: 'Circuit désert 4 jours en 4x4 privé : El Jem, Matmata, Douz, nuit au campement de Ksar Ghilane et Chenini. Départ de Tunis, paiement sur place.',
      h1: 'Circuit désert 4 jours : du Sahara aux ksour de Tataouine',
    },
  },
  {
    title: 'Circuit express 2 jours dans le Sud tunisien',
    category: 'desert', durationLabel: '2 jours / 1 nuit', durationHours: 36, departureCities: ['Sousse', 'Hammamet', 'Monastir', 'Mahdia'],
    summary: 'Le Sud tunisien en deux jours : Matmata et ses maisons troglodytes, les dunes de Douz au coucher du soleil et l’oasis de Ksar Ghilane en 4x4.',
    description: `Vous n’avez que deux jours mais vous voulez voir le désert ? Ce circuit Sud tunisien 2 jours, privé, est fait pour vous. Départ tôt le matin de votre hôtel en véhicule climatisé, direction Matmata, village berbère célèbre pour ses habitations troglodytes et pour avoir servi de décor de cinéma.

L’après-midi, vous rejoignez Douz, aux portes du Grand Erg oriental. À l’heure du coucher du soleil, place aux dunes : balade à dromadaire ou session de quad selon vos envies. Le soir, dîner traditionnel puis nuit à Douz.

Le lendemain, un 4x4 vous conduit à l’oasis de Ksar Ghilane, au milieu des dunes. Vous profitez de la source d’eau chaude naturelle ou repartez en quad sur le sable, puis déjeunez au campement avant de reprendre la route du retour.

Un format idéal pour les séjours courts, en couple, en famille ou entre amis. Le programme se concentre sur Matmata, Douz et Ksar Ghilane : pour Tozeur et le Chott el-Jérid, choisissez plutôt notre circuit de 4 jours.`,
    more: `Bon à savoir : la nuit se passe à Douz, dans un hébergement confirmé lors de votre demande. Le circuit démarre tôt pour profiter de la lumière du désert et revenir le lendemain en fin de journée. Laissez votre valise à l’hôtel : un petit sac avec maillot de bain, serviette, pull et crème solaire suffit. Le dromadaire et le quad sont des options à choisir sur place. En juillet et en août, la chaleur est très forte en milieu de journée : le printemps et l’automne sont plus agréables. Le paiement se fait sur place, sans réservation payante en ligne. Envoyez-nous votre demande : nous vous répondons rapidement par e-mail ou par WhatsApp.`,
    related: ['circuit-desert-4-jours', 'excursion-kairouan'],
    highlights: ['Coucher de soleil sur les dunes de Douz', 'Oasis de Ksar Ghilane en 4x4', 'Maisons troglodytes de Matmata', 'Formule courte, idéale pour un séjour balnéaire'],
    included: ['Transport privé climatisé aller-retour depuis votre hôtel', 'Transfert en 4x4 vers Ksar Ghilane', 'Une nuit à Douz', 'Dîner traditionnel le jour 1 et déjeuner au campement le jour 2'],
    notIncluded: ['Entrées des sites', 'Balade à dromadaire et quad (en option)', 'Boissons et pourboires'],
    toBring: ['Petit sac pour une nuit', 'Maillot de bain et serviette', 'Pull pour la soirée', SUN, GOOD_SHOES],
    program: [
      ['Jour 1', 'Départ tôt de l’hôtel – Matmata et ses maisons troglodytes – Douz : dunes au coucher du soleil, dîner et nuit.'],
      ['Jour 2', 'Douz – Ksar Ghilane en 4x4 : source chaude ou quad, déjeuner au campement, retour à l’hôtel en fin de journée.'],
    ],
    faq: [
      ['Faut-il emporter sa valise ?', 'Non, un petit sac suffit pour la nuit. Vos bagages restent à l’hôtel.'],
      ['Ce circuit passe-t-il par Tozeur ?', 'Non. Pour Tozeur, le Chott el-Jérid et les oasis de montagne, choisissez un circuit plus long.'],
    ],
    images: [img('saharaDune', 'Circuit Sud tunisien 2 jours : sommet d’une dune du Sahara'), img('ksarGhilane', 'Dunes du Sahara à Ksar Ghilane')],
    stops: stops('sousse', 'matmata', 'douz', 'ksarGhilane', 'sousse'),
    seo: {
      focusKeyword: 'circuit sud tunisien 2 jours',
      metaTitle: 'Circuit Sud tunisien 2 jours : Matmata, Douz et Ksar Ghilane',
      metaDescription: 'Circuit Sud tunisien 2 jours privé : Matmata, dunes de Douz au coucher du soleil et oasis de Ksar Ghilane en 4x4. Départ de votre hôtel, paiement sur place.',
      h1: 'Circuit Sud tunisien 2 jours : le désert en version express',
    },
  },
  {
    title: 'La Tunisie authentique en 7 jours : Nord et sites antiques',
    category: 'culture', durationLabel: '7 jours / 6 nuits', durationHours: 168, departureCities: ['Tunis'],
    summary: 'Une semaine dans le Nord tunisien : médina de Tunis, Carthage, Bizerte, Dougga, Bulla Regia, Tabarka, Le Kef et Zaghouan, en minibus privé.',
    description: `Ce circuit Tunisie 7 jours vous fait découvrir une Tunisie plus verte et plus secrète, loin des stations balnéaires. Votre chauffeur vous attend à l’aéroport Tunis-Carthage et vous installe à Sidi Bou Saïd, qui sera votre point de chute pour les premiers jours.

Le deuxième jour est consacré à la médina de Tunis, classée à l’UNESCO, et à ses souks, puis aux vestiges de Carthage. Le troisième jour, cap au nord vers le site antique d’Utique et le vieux port de Bizerte, aux maisons colorées.

Le circuit s’enfonce ensuite dans l’intérieur des terres : Testour et son héritage andalou, puis Dougga, la plus belle cité romaine du pays. Le cinquième jour, les villas souterraines de Bulla Regia précèdent l’arrivée à Tabarka, entre mer et forêt de chênes-lièges. Le sixième jour, vous montez au Kef, avec sa médina et sa citadelle, avant de parcourir les villages de montagne alentour.

Pour finir, le septième jour réunit trois sites majeurs sur la route du retour : Thuburbo Majus, le Temple des Eaux de Zaghouan et Oudhna. Un voyage culturel, à un rythme tranquille, en minibus privé avec chauffeur.`,
    more: `Bon à savoir : les trois premières nuits se passent à Sidi Bou Saïd, ce qui évite de défaire sa valise chaque soir ; les hôtels suivants sont confirmés avec votre programme. Les visites se font à pied, parfois sur des sols irréguliers : de bonnes chaussures sont indispensables. Dans les médinas et près des mosquées, une tenue couvrant les épaules et les genoux est appréciée. Le circuit est privé : le chauffeur adapte les horaires à votre rythme, et vous pouvez le prolonger par quelques jours dans le désert. Indiquez l’âge des enfants pour que nous prévoyions des sièges adaptés. Envoyez-nous votre demande : nous vous répondons rapidement par e-mail ou par WhatsApp.`,
    related: ['circuit-desert-4-jours', 'excursion-bulla-regia'],
    highlights: ['Médina de Tunis et souks', 'Dougga et Bulla Regia, joyaux romains', 'Bizerte, Tabarka et Le Kef', 'Base à Sidi Bou Saïd les premiers jours', 'Minibus privé avec chauffeur'],
    included: ['Accueil à l’aéroport Tunis-Carthage', 'Transport en minibus privé avec chauffeur', 'Hébergement 6 nuits'],
    notIncluded: ['Entrées des sites et musées', 'Repas', 'Vols', 'Pourboires'],
    toBring: [GOOD_SHOES, 'Tenue couvrant épaules et genoux pour les médinas', 'Chapeau et bouteille d’eau', 'Veste en hiver pour Le Kef et Tabarka'],
    program: [
      ['Jour 1', 'Accueil à l’aéroport Tunis-Carthage, installation à Sidi Bou Saïd, temps libre.'],
      ['Jour 2', 'Médina de Tunis et ses souks, puis l’après-midi à Carthage. Retour à Sidi Bou Saïd.'],
      ['Jour 3', 'Site antique d’Utique et vieux port de Bizerte. Retour à Sidi Bou Saïd.'],
      ['Jour 4', 'Testour, village andalou, puis visite de Dougga l’après-midi.'],
      ['Jour 5', 'Villas souterraines de Bulla Regia, route vers Tabarka.'],
      ['Jour 6', 'Médina et citadelle du Kef, villages de montagne des environs.'],
      ['Jour 7', 'Thuburbo Majus, Temple des Eaux de Zaghouan et Oudhna, retour à Tunis.'],
    ],
    faq: [
      ['Quand partir ?', 'Au printemps et en automne. En hiver, Le Kef et Tabarka peuvent être froids et pluvieux.'],
      ['Peut-on prolonger vers le désert ?', 'Oui, ce circuit se combine avec notre circuit désert de 4 jours.'],
    ],
    images: [img('carthage', 'Circuit Tunisie 7 jours : ruines de Carthage face à la mer'), img('sidiBouSaidStreet', 'Ruelle blanche et bleue de Sidi Bou Saïd')],
    stops: stops('tunisAirport', 'sidiBouSaid', 'tunisMedina', 'carthage', 'utique', 'bizerte', 'testour', 'dougga', 'bullaRegia', 'tabarka', 'kef', 'thuburbo', 'zaghouan', 'oudhna', 'tunisMedina'),
    seo: {
      focusKeyword: 'circuit tunisie 7 jours',
      metaTitle: 'Circuit Tunisie 7 jours : Tunis, Dougga, Tabarka, Le Kef',
      metaDescription: 'Circuit Tunisie 7 jours en minibus privé : médina de Tunis, Carthage, Bizerte, Dougga, Bulla Regia, Tabarka, Le Kef et Zaghouan. Accueil à l’aéroport.',
      h1: 'Circuit Tunisie 7 jours : le Nord authentique',
    },
  },
  {
    title: 'Grand circuit 8 jours : trésors du Nord et du Sud tunisien',
    category: 'culture', durationLabel: '8 jours / 7 nuits', durationHours: 192, departureCities: ['Tunis'],
    summary: 'Huit jours pour voir l’essentiel : Tunis, Carthage, Dougga, Kairouan, El Jem, les oasis de montagne en 4x4, le Chott el-Jérid, Douz et Matmata.',
    description: `Ce circuit Tunisie 8 jours, en véhicule privé, relie les plus beaux sites du Nord et du Sud en huit jours. Vous commencez par une nuit dans une maison d’hôtes au cœur de la médina de Tunis, puis le lendemain par la visite guidée de la médina, de Carthage et de Sidi Bou Saïd.

Le troisième jour, Dougga vous plonge dans l’Antiquité romaine avant la route vers Kairouan, première ville sainte du Maghreb. Le lendemain, vous découvrez sa Grande Mosquée et les bassins aghlabides, puis l’amphithéâtre d’El Jem, avant de rejoindre Tozeur et ses palmeraies.

Le cinquième jour, une excursion en 4x4 vous mène aux oasis de montagne de Chebika, Tamerza et Midès, avec de courtes marches dans les gorges. Le sixième jour, vous traversez le Chott el-Jérid, faites une halte à Douz, puis rejoignez Matmata pour une nuit en bivouac.

Le septième jour, visite d’une maison troglodyte avant de remonter vers Tunis. Le dernier jour est libre pour vos achats dans les souks, puis votre chauffeur vous conduit à l’aéroport. Un voyage complet, en véhicule privé climatisé, adapté aux familles comme aux couples.`,
    more: `Bon à savoir : la première nuit se passe dans une maison d’hôtes de la médina de Tunis et la sixième en bivouac près de Matmata ; les autres hébergements sont précisés avec votre programme. Prévoyez une couche chaude pour la nuit au désert, des chaussures fermées pour les gorges de Chebika et une tenue couvrante pour Kairouan. La balade à dromadaire à Douz est proposée en option. Certaines étapes sont longues, mais le véhicule est réservé à votre groupe et le rythme s’adapte à vous. Le circuit convient aux enfants qui supportent bien la route. Envoyez-nous votre demande : nous vous répondons rapidement par e-mail ou par WhatsApp.`,
    related: ['circuit-desert-4-jours', 'circuit-tunisie-7-jours'],
    highlights: ['Nord et Sud en un seul voyage', 'Oasis de montagne de Chebika, Tamerza et Midès en 4x4', 'Kairouan et El Jem', 'Nuit en bivouac près de Matmata', 'Maison d’hôtes dans la médina de Tunis'],
    included: ['Véhicule privé climatisé avec chauffeur, 4x4 le jour 5', 'Hébergement 7 nuits, dont une maison d’hôtes et un bivouac', 'Transfert vers l’aéroport le dernier jour'],
    notIncluded: ['Entrées des sites et musées', 'Repas', 'Balade à dromadaire à Douz (en option)', 'Pourboires'],
    toBring: [GOOD_SHOES, 'Couche chaude pour le bivouac', SUN, 'Tenue couvrant épaules et genoux pour Kairouan'],
    program: [
      ['Jour 1', 'Arrivée à Tunis, installation dans une maison d’hôtes de la médina.'],
      ['Jour 2', 'Visite guidée de la médina de Tunis, puis Carthage et Sidi Bou Saïd.'],
      ['Jour 3', 'Site romain de Dougga, route vers Kairouan.'],
      ['Jour 4', 'Grande Mosquée et bassins aghlabides de Kairouan, amphithéâtre d’El Jem, arrivée à Tozeur.'],
      ['Jour 5', 'Oasis de montagne en 4x4 : Chebika, Tamerza et Midès, marches dans les gorges.'],
      ['Jour 6', 'Traversée du Chott el-Jérid, halte à Douz, arrivée à Matmata et nuit en bivouac.'],
      ['Jour 7', 'Maison troglodyte de Matmata, route du retour vers Tunis.'],
      ['Jour 8', 'Temps libre dans les souks, transfert à l’aéroport.'],
    ],
    faq: [
      ['Les trajets sont-ils longs ?', 'Certaines journées comptent plusieurs heures de route, avec des pauses régulières. Le rythme s’adapte à votre groupe.'],
      ['Quelle saison choisir ?', 'Le printemps et l’automne. L’été est très chaud dans le Sud.'],
    ],
    images: [img('southPalm', 'Circuit Tunisie 8 jours : palmier et montagne du Sud'), img('elJem', 'Amphithéâtre romain d’El Jem')],
    stops: stops('tunisMedina', 'carthage', 'sidiBouSaid', 'dougga', 'kairouan', 'elJem', 'tozeur', 'chebika', 'tamerza', 'mides', 'chott', 'douz', 'matmata', 'tunisAirport'),
    seo: {
      focusKeyword: 'circuit tunisie 8 jours',
      metaTitle: 'Circuit Tunisie 8 jours : Nord et Sud en véhicule privé',
      metaDescription: 'Circuit Tunisie 8 jours privé : Tunis, Carthage, Dougga, Kairouan, El Jem, oasis de Chebika en 4x4, Chott el-Jérid, Douz et bivouac à Matmata.',
      h1: 'Circuit Tunisie 8 jours : le grand tour du pays',
    },
  },

  /* ============================ EXCURSIONS À LA JOURNÉE ============================ */
  {
    title: 'Excursion Bulla Regia et Dougga en une journée',
    category: 'culture', durationLabel: 'Journée (9 h – 19 h)', durationHours: 10, departureCities: DAY_TRIP_CITIES, startTimes: ['09:00'],
    summary: 'Deux grandes cités romaines du Nord-Ouest en une journée : les villas souterraines de Bulla Regia et le site de Dougga, classé à l’UNESCO.',
    description: `Cette excursion Bulla Regia et Dougga réunit, en privé, deux sites romains exceptionnels du Nord-Ouest tunisien. Votre chauffeur vient vous chercher à 9 h et vous conduit d’abord à Bulla Regia, près de Jendouba. Ici, les riches Romains vivaient sous terre pour échapper à la chaleur : vous descendez dans leurs villas pour admirer des mosaïques restées en place, comme celle d’Amphitrite.

L’après-midi est consacré à Dougga, cité antique perchée sur une colline et inscrite au patrimoine mondial. Vous parcourez ses rues pavées, son théâtre, son Capitole, ses thermes et son mausolée libyco-punique, avec une vue superbe sur la campagne environnante.

Le retour est prévu vers 19 h. La journée comporte une bonne part de route : c’est le prix à payer pour découvrir deux des sites les mieux conservés du pays, loin de la foule. Le véhicule climatisé est réservé à votre groupe et l’ordre des visites peut être adapté à la saison.

À savoir : les escaliers des villas souterraines sont raides et sans rampe, et l’intérieur est sombre. Les parties en surface, dont le théâtre, se visitent sans descendre.`,
    more: `Bon à savoir : Bulla Regia est l’un des sites les plus chauds du pays en juillet et en août ; d’octobre à mai, la visite est bien plus agréable. En hiver, le Nord-Ouest peut être froid et pluvieux : prévoyez un pull et des chaussures fermées. Le site n’est pas adapté aux fauteuils roulants ni aux poussettes, mais les parties en surface restent accessibles. Les billets d’entrée se règlent sur place, et un guide officiel peut vous accompagner sur demande. Comme toujours chez JS Travel, vous payez le jour même, sans acompte. Envoyez-nous votre demande : nous vous répondons rapidement par e-mail ou par WhatsApp.`,
    related: ['excursion-zaghouan', 'excursion-tunis-carthage'],
    highlights: ['Villas souterraines et mosaïques de Bulla Regia', 'Dougga, cité romaine classée à l’UNESCO', 'Véhicule privé climatisé', 'Rythme adapté à votre groupe'],
    included: ['Véhicule privé climatisé avec chauffeur', 'Prise en charge à votre hôtel et retour'],
    notIncluded: ['Entrées des sites', 'Déjeuner', 'Guide officiel sur place (en option)'],
    toBring: [GOOD_SHOES, 'Lampe de téléphone pour les villas souterraines', 'Bouteille d’eau', 'Pull en hiver'],
    program: [['09:00', 'Prise en charge à votre hôtel'], ['Matin', 'Bulla Regia : villas souterraines et mosaïques'], ['Après-midi', 'Dougga : théâtre, Capitole, thermes et mausolée'], ['19:00', 'Retour à l’hôtel']],
    faq: [['Le site est-il accessible en poussette ?', 'Non, les sols sont irréguliers et les villas se visitent par des escaliers raides.']],
    images: [],
    stops: stops('bullaRegia', 'dougga'),
    seo: {
      focusKeyword: 'excursion bulla regia',
      metaTitle: 'Excursion Bulla Regia et Dougga privée en une journée',
      metaDescription: 'Excursion Bulla Regia et Dougga en véhicule privé : villas souterraines, mosaïques et cité romaine classée à l’UNESCO. Prise en charge à l’hôtel à 9 h.',
      h1: 'Excursion Bulla Regia et Dougga : deux joyaux romains',
    },
  },
  {
    title: 'Demi-journée à Friguia Park',
    category: 'family', durationLabel: 'Demi-journée (4 h)', durationHours: 4, departureCities: ['Hammamet', 'Sousse'], startTimes: ['08:30', '14:00'],
    summary: 'Une demi-journée en famille au parc animalier Friguia, entre Hammamet et Sousse : lions, girafes, éléphants et spectacle de dauphins.',
    description: `Friguia Park est le grand parc animalier de Tunisie, situé à Bouficha, entre Hammamet et Sousse. Sur une trentaine d’hectares, vous croisez des centaines d’animaux venus d’Afrique et d’ailleurs : lions, girafes, éléphants, hippopotames, singes et oiseaux exotiques.

Le temps fort de la visite est le spectacle de dauphins, très apprécié des enfants, complété par les numéros des otaries et des animations folkloriques. Vous visitez le parc librement, à votre rythme.

Nous venons vous chercher à votre hôtel à Hammamet, Yasmine Hammamet, Sousse ou Port El Kantaoui, en véhicule climatisé réservé à votre famille, puis nous vous déposons à l’entrée du parc. Deux créneaux sont proposés : le matin de 8 h 30 à 12 h 30, ou l’après-midi de 14 h à 18 h. Les horaires des spectacles changent selon la saison : indiquez-nous si vous tenez au spectacle de dauphins et nous vous conseillerons le meilleur créneau.

Une sortie idéale avec des enfants, facile et sans longue route. En été, préférez le matin pour éviter la chaleur.`,
    more: `Bon à savoir : la visite se fait entièrement à pied, sur des allées faciles ; une poussette est conseillée pour les enfants de moins de 4 ans. En été, le matin est plus agréable pour profiter des animaux à la fraîche. Les billets d’entrée du parc ne sont pas compris dans le transport : nous vous indiquons le tarif en vigueur lors de votre demande. Les sièges enfants sont fournis gratuitement. C’est une sortie très appréciée des familles en séjour à Hammamet, Yasmine Hammamet, Sousse ou Port El Kantaoui, facile à glisser entre deux journées de plage. Envoyez-nous votre demande : nous vous répondons rapidement par e-mail ou par WhatsApp.`,
    related: ['excursion-sousse-monastir', 'excursion-cap-bon'],
    highlights: ['Spectacle de dauphins et d’otaries', 'Lions, girafes, éléphants', 'Parfait pour les familles', 'Sièges enfants gratuits sur demande'],
    included: ['Transport privé climatisé aller-retour', 'Sièges enfants sur demande'],
    notIncluded: ['Billets d’entrée du parc', 'Repas et boissons'],
    toBring: ['Casquette et crème solaire', 'Une bouteille d’eau par personne', GOOD_SHOES, 'Poussette pour les moins de 4 ans'],
    program: [['08:30 ou 14:00', 'Prise en charge à votre hôtel'], ['Sur place', 'Visite libre du parc, spectacles de dauphins et d’otaries'], ['12:30 ou 18:00', 'Retour à l’hôtel']],
    faq: [['Quel créneau choisir ?', 'Le matin en été, pour la fraîcheur. Précisez si vous voulez voir le spectacle de dauphins : nous vérifions les horaires du jour.']],
    images: [],
    stops: stops('friguia'),
    seo: {
      focusKeyword: 'friguia park',
      metaTitle: 'Friguia Park en demi-journée, transport privé de l’hôtel',
      metaDescription: 'Friguia Park en famille : lions, girafes, éléphants et spectacle de dauphins. Transport privé depuis Hammamet ou Sousse, le matin ou l’après-midi.',
      h1: 'Friguia Park : une demi-journée en famille',
    },
  },
  {
    title: 'Excursion Cap Bon : Hammamet, Nabeul, Kélibia et Kerkouane',
    category: 'culture', durationLabel: 'Journée (9 h – 19 h)', durationHours: 10, departureCities: DAY_TRIP_CITIES, startTimes: ['09:00'],
    summary: 'Le tour du Cap Bon en une journée : médina de Hammamet, poteries de Nabeul, fort de Kélibia, cité punique de Kerkouane et côte sauvage.',
    description: `La péninsule du Cap Bon, au nord-est du pays, mêle plages, vergers, villages de pêcheurs et vestiges antiques. Cette excursion Cap Bon privée vous en fait faire le tour en une journée.

Après la prise en charge vers 9 h, vous flânez dans la médina de Hammamet, puis découvrez les ateliers de poterie de Nabeul, capitale tunisienne de la céramique. La route longe ensuite la côte est jusqu’à Kélibia, son port de pêche et son fort qui domine la mer.

Après le déjeuner, à l’endroit de votre choix, vous visitez Kerkouane, seule cité punique conservée telle qu’elle était, inscrite au patrimoine mondial. L’après-midi se poursuit vers El Haouaria et ses grottes marines, puis par la route côtière jusqu’aux sources chaudes de Korbous, avant le retour vers 19 h.

Le véhicule est réservé à votre groupe : vous pouvez prolonger une étape ou en raccourcir une autre. Les marches sont faciles, à part la montée au fort de Kélibia. Le printemps est la saison idéale, quand la campagne est en fleurs.`,
    more: `Bon à savoir : l’itinéraire compte six étapes, que nous pouvons réorganiser selon vos priorités, par exemple pour passer plus de temps à Kerkouane ou à la plage de Kélibia. Le site punique offre peu d’ombre : chapeau, crème solaire et eau sont indispensables en été. Prévoyez des chaussures confortables pour les pavés de la médina et la montée au fort. Les enfants apprécient les courtes étapes et la route côtière. Les entrées des sites et le déjeuner restent à votre charge ; le paiement de l’excursion se fait sur place. Au printemps, quand la campagne du Cap Bon est en fleurs, la route est particulièrement belle. Envoyez-nous votre demande : nous vous répondons rapidement par e-mail ou par WhatsApp.`,
    related: ['excursion-tunis-carthage', 'friguia-park'],
    highlights: ['Kerkouane, cité punique classée à l’UNESCO', 'Fort de Kélibia face à la mer', 'Poteries de Nabeul', 'Route côtière jusqu’à Korbous'],
    included: ['Véhicule privé climatisé avec chauffeur', 'Prise en charge à votre hôtel et retour', 'Siège enfant sur demande'],
    notIncluded: ['Entrées des sites', 'Déjeuner'],
    toBring: [SUN, 'Bouteille d’eau (peu d’ombre à Kerkouane)', GOOD_SHOES],
    program: [['09:00', 'Prise en charge'], ['Matin', 'Médina de Hammamet et ateliers de poterie de Nabeul'], ['Fin de matinée', 'Kélibia : port et fort'], ['Midi', 'Déjeuner libre puis Kerkouane'], ['Après-midi', 'El Haouaria, route côtière et Korbous'], ['19:00', 'Retour']],
    faq: [['Le déjeuner est-il compris ?', 'Non, vous déjeunez où vous le souhaitez ; votre chauffeur peut vous conseiller une adresse.']],
    images: [],
    stops: stops('hammamet', 'nabeul', 'kelibia', 'kerkouane', 'haouaria', 'korbous'),
    seo: {
      focusKeyword: 'excursion cap bon',
      metaTitle: 'Excursion Cap Bon privée : Nabeul, Kélibia, Kerkouane',
      metaDescription: 'Excursion Cap Bon en véhicule privé : médina de Hammamet, poteries de Nabeul, fort de Kélibia, cité punique de Kerkouane et Korbous. Journée complète.',
      h1: 'Excursion Cap Bon : le tour de la péninsule en une journée',
    },
  },
  {
    title: 'Excursion Zaghouan, Thuburbo Majus et Dougga',
    category: 'culture', durationLabel: 'Journée (9 h – 19 h)', durationHours: 10, departureCities: DAY_TRIP_CITIES, startTimes: ['09:00'],
    summary: 'Une journée sur les traces de Rome : le Temple des Eaux de Zaghouan, les ruines de Thuburbo Majus et la grande cité de Dougga.',
    description: `Cette excursion Zaghouan, Thuburbo Majus et Dougga suit, en privé, la route de l’eau et des cités romaines de l’arrière-pays tunisien. Départ à 9 h en véhicule climatisé réservé à votre groupe.

Première étape à Zaghouan, au pied de la montagne, devant le Temple des Eaux : c’est d’ici que partait l’aqueduc qui alimentait Carthage, à plus de 100 km. À midi, vous découvrez Thuburbo Majus, une cité romaine peu fréquentée, avec son Capitole, son forum, sa palestre et ses thermes d’été et d’hiver.

L’après-midi, la visite la plus longue vous attend à Dougga, site inscrit au patrimoine mondial. Sur les pentes d’une colline, vous parcourez le théâtre, le Capitole, les temples, les maisons et les thermes d’une ville antique remarquablement conservée.

Le retour est prévu vers 19 h. Comme l’excursion est privée, vous pouvez rester plus longtemps sur un site ou demander une pause quand vous le souhaitez. Prévoyez de bonnes chaussures : les chemins sont pavés et en pente à Dougga.`,
    more: `Bon à savoir : prévoyez de la crème solaire, des lunettes, une bouteille d’eau par personne et un peu de monnaie pour les entrées. Les sites ont peu d’ombre ; un chapeau est indispensable en été, et le printemps comme l’automne sont les saisons les plus agréables. Les chemins sont pavés et en pente à Dougga : choisissez des chaussures fermées à bonne adhérence. Un guide officiel peut vous accompagner sur place si vous le souhaitez, pour mieux comprendre la vie quotidienne dans une ville romaine d’Afrique du Nord. L’excursion se règle le jour même auprès de votre chauffeur, sans paiement à l’avance. Envoyez-nous votre demande : nous vous répondons rapidement par e-mail ou par WhatsApp.`,
    related: ['excursion-bulla-regia', 'excursion-tunis-carthage'],
    highlights: ['Temple des Eaux de Zaghouan', 'Thuburbo Majus, loin de la foule', 'Dougga, classée à l’UNESCO', 'Excursion privée, rythme libre'],
    included: ['Véhicule privé climatisé avec chauffeur', 'Prise en charge à votre hôtel et retour'],
    notIncluded: ['Entrées des sites', 'Déjeuner', 'Guide officiel sur place (en option)'],
    toBring: ['Chaussures fermées à semelle antidérapante', SUN, 'Une bouteille d’eau par personne', 'Un peu de monnaie'],
    program: [['09:00', 'Prise en charge'], ['Matin', 'Temple des Eaux de Zaghouan'], ['Midi', 'Ruines de Thuburbo Majus'], ['Après-midi', 'Visite de Dougga'], ['19:00', 'Retour']],
    faq: [['Convient-elle aux enfants ?', 'Oui pour les enfants curieux d’histoire ; la journée comporte beaucoup de route et les poussettes sont peu pratiques.']],
    images: [],
    stops: stops('zaghouan', 'thuburbo', 'dougga'),
    seo: {
      focusKeyword: 'excursion zaghouan',
      metaTitle: 'Excursion Zaghouan, Thuburbo Majus et Dougga en privé',
      metaDescription: 'Excursion Zaghouan, Thuburbo Majus et Dougga en véhicule privé : Temple des Eaux, forum romain et cité antique de Dougga. Départ 9 h, retour 19 h.',
      h1: 'Excursion Zaghouan et Dougga : sur la route de Rome',
    },
  },
  {
    title: 'Excursion Kairouan, El Jem et Monastir',
    category: 'culture', durationLabel: 'Journée (9 h – 19 h)', durationHours: 10, departureCities: DAY_TRIP_CITIES, startTimes: ['09:00'],
    summary: 'Trois villes, trois époques : la ville sainte de Kairouan, l’amphithéâtre romain d’El Jem et le ribat de Monastir, en véhicule privé.',
    description: `Cette excursion Kairouan, El Jem et Monastir réunit en une journée privée trois incontournables du centre-est tunisien. Prise en charge vers 9 h à votre hôtel, en véhicule climatisé réservé à votre groupe.

Le matin, vous découvrez Kairouan, première ville sainte du Maghreb : la cour et les arcades de la Grande Mosquée, les bassins aghlabides qui alimentaient la ville en eau, puis la médina, ses ateliers de tapis et ses makrouds, pâtisseries aux dattes typiques de la ville.

À midi, pause déjeuner sur la route, puis visite de l’amphithéâtre d’El Jem, l’un des plus grands du monde romain : vous montez dans les gradins et descendez dans les galeries souterraines où attendaient gladiateurs et fauves.

En fin d’après-midi, vous rejoignez Monastir pour son ribat, sa kasbah, une courte promenade dans la médina et le front de mer, avant le retour vers 19 h. L’ordre des visites peut être adapté selon votre point de départ et la saison.

Pour la mosquée, prévoyez une tenue couvrant les épaules et les genoux ; la salle de prière est réservée aux fidèles.`,
    more: `Bon à savoir : à El Jem, les marches des gradins sont hautes et irrégulières, alors que Kairouan est plat et facile à parcourir. Pensez à l’eau, au chapeau et à la crème solaire, surtout en été ; le printemps et l’automne sont les saisons les plus douces. Les entrées des monuments et le déjeuner ne sont pas compris, et un siège enfant est fourni sur demande. Cette journée convient aux familles : les enfants adorent les souterrains de l’amphithéâtre. Vous payez sur place, et l’excursion se combine bien avec notre journée dans le Sahel. Envoyez-nous votre demande : nous vous répondons rapidement par e-mail ou par WhatsApp.`,
    related: ['excursion-sousse-monastir', 'circuit-sud-tunisien-2-jours'],
    highlights: ['Grande Mosquée de Kairouan', 'Gradins et souterrains d’El Jem', 'Ribat de Monastir', 'Pâtisseries traditionnelles de Kairouan'],
    included: ['Véhicule privé climatisé avec chauffeur', 'Prise en charge à votre hôtel et retour', 'Siège enfant sur demande'],
    notIncluded: ['Entrées des sites', 'Déjeuner'],
    toBring: ['Tenue couvrant épaules et genoux (foulard pour les femmes)', GOOD_SHOES, SUN, 'Bouteille d’eau'],
    program: [['09:00', 'Prise en charge'], ['Matin', 'Kairouan : Grande Mosquée, bassins aghlabides et médina'], ['Midi', 'Déjeuner puis amphithéâtre d’El Jem'], ['Fin d’après-midi', 'Monastir : ribat, médina et front de mer'], ['19:00', 'Retour']],
    faq: [['Peut-on entrer dans la mosquée ?', 'La cour se visite ; la salle de prière est réservée aux fidèles. Une tenue couvrante est demandée.']],
    images: [img('elJem', 'Amphithéâtre d’El Jem, étape de l’excursion Kairouan')],
    stops: stops('kairouan', 'elJem', 'monastir'),
    seo: {
      focusKeyword: 'excursion kairouan',
      metaTitle: 'Excursion Kairouan, El Jem et Monastir en véhicule privé',
      metaDescription: 'Excursion Kairouan, El Jem et Monastir en privé : Grande Mosquée, bassins aghlabides, amphithéâtre romain et ribat de Monastir. Prise en charge à l’hôtel.',
      h1: 'Excursion Kairouan, El Jem et Monastir en une journée',
    },
  },
  {
    title: 'Excursion Tunis, Carthage et Sidi Bou Saïd en une journée',
    category: 'culture', durationLabel: 'Journée (9 h – 19 h)', durationHours: 10, departureCities: DAY_TRIP_CITIES, startTimes: ['09:00'],
    summary: 'La capitale en une journée : médina de Tunis, musée du Bardo et ses mosaïques, ruines de Carthage et coucher de soleil à Sidi Bou Saïd.',
    description: `Cette excursion Tunis Carthage et Sidi Bou Saïd vous fait découvrir, en privé, le Grand Tunis en une journée bien remplie. Prise en charge vers 9 h à votre hôtel, en véhicule climatisé réservé à votre groupe, y compris depuis Hammamet ou Sousse.

Vous commencez par la médina de Tunis, classée à l’UNESCO : entrée par la porte de France (Bab el Bhar), mosquée Zitouna et souks parfumés, plus agréables le matin. Direction ensuite le musée du Bardo, installé dans un ancien palais beylical, qui abrite l’une des plus riches collections de mosaïques romaines au monde.

L’après-midi, vous parcourez les vestiges de Carthage, dont les thermes d’Antonin au bord de la mer. La journée se termine à Sidi Bou Saïd, village blanc et bleu perché sur la falaise : promenade dans les ruelles, thé au Café des Nattes, bambalouni tout chaud et vue sur le golfe.

Le retour est prévu vers 19 h. Le chauffeur vous dépose au plus près de chaque site et le rythme s’adapte à votre groupe. Prévoyez de bonnes chaussures : pavés glissants dans la médina et rues en pente à Sidi Bou Saïd.`,
    more: `Bon à savoir : un peu de marche est nécessaire, mais le véhicule vous dépose au plus près de chaque site. Carthage offre peu d’ombre : eau, chapeau et crème solaire sont recommandés en été. Les ruelles étroites de la médina et de Sidi Bou Saïd sont peu pratiques en poussette. Les entrées du Bardo et de Carthage ne sont pas comprises ; nous vous indiquons les tarifs lors de votre demande. L’excursion fonctionne toute l’année, et le départ est possible depuis Tunis, Hammamet ou Sousse. Paiement sur place, sans acompte. Envoyez-nous votre demande : nous vous répondons rapidement par e-mail ou par WhatsApp.`,
    related: ['excursion-cap-bon', 'excursion-zaghouan'],
    highlights: ['Médina de Tunis, classée à l’UNESCO', 'Mosaïques du musée du Bardo', 'Thermes d’Antonin à Carthage', 'Fin de journée à Sidi Bou Saïd'],
    included: ['Véhicule privé climatisé avec chauffeur', 'Prise en charge à votre hôtel et retour', 'Siège enfant sur demande'],
    notIncluded: ['Entrées du Bardo et de Carthage', 'Déjeuner et dégustations'],
    toBring: [GOOD_SHOES, SUN, 'Bouteille d’eau', 'Tenue couvrant épaules et genoux près des mosquées'],
    program: [['09:00', 'Prise en charge'], ['Matin', 'Médina de Tunis et souks'], ['Fin de matinée', 'Musée du Bardo'], ['Après-midi', 'Carthage et thermes d’Antonin'], ['Fin d’après-midi', 'Sidi Bou Saïd'], ['19:00', 'Retour']],
    faq: [['Peut-on partir de Hammamet ou de Sousse ?', 'Oui, nous venons vous chercher à votre hôtel ; le temps de route est compris dans la journée.']],
    images: [img('sidiBouSaidSea', 'Sidi Bou Saïd, étape de l’excursion Tunis Carthage'), img('carthage', 'Ruines antiques de Carthage face à la mer')],
    stops: stops('tunisMedina', 'bardo', 'carthage', 'sidiBouSaid'),
    seo: {
      focusKeyword: 'excursion tunis carthage',
      metaTitle: 'Excursion Tunis Carthage et Sidi Bou Saïd en véhicule privé',
      metaDescription: 'Excursion Tunis Carthage et Sidi Bou Saïd en véhicule privé : médina, musée du Bardo, thermes d’Antonin et village bleu et blanc. Prise en charge à l’hôtel.',
      h1: 'Excursion Tunis Carthage et Sidi Bou Saïd en une journée',
    },
  },
  {
    title: 'Excursion Sahel : Port El Kantaoui, Sousse et Monastir',
    category: 'culture', durationLabel: 'Journée (9 h – 19 h)', durationHours: 10, departureCities: DAY_TRIP_CITIES, startTimes: ['09:00'],
    summary: 'Une journée facile sur la côte du Sahel : marina de Port El Kantaoui, médina et ribat de Sousse, ribat et mausolée de Monastir.',
    description: `Cette excursion Sousse Monastir, avec une halte à Port El Kantaoui, explore en privé le Sahel, la côte la plus animée de Tunisie, sans longues heures de route. Idéale pour une première découverte ou avec des enfants.

Après la prise en charge vers 9 h, vous commencez par une promenade sur la marina de Port El Kantaoui, avec ses bateaux et ses cafés. En fin de matinée, vous entrez dans la médina de Sousse, classée à l’UNESCO : son ribat, dont la tour offre une belle vue sur la ville, les abords de la Grande Mosquée et les souks.

À midi, pause déjeuner à l’endroit de votre choix, dans la médina ou au bord de la mer. L’après-midi est consacré à Monastir : son ribat, l’un des plus anciens du pays, le mausolée de Habib Bourguiba et la marina.

Le retour est prévu vers 19 h, et l’ordre des visites peut être inversé selon votre hôtel. Les marches sont courtes et faciles, mais les escaliers des tours de guet sont raides : tenez la main des plus petits.`,
    more: `Bon à savoir : c’est l’une de nos excursions les plus faciles, avec peu de route et des visites courtes, parfaite pour une première sortie ou avec des enfants. Les pavés de la médina sont irréguliers : préférez des chaussures fermées. Une tenue couvrant les épaules et les genoux est demandée au mausolée et près de la mosquée. En été, prévoyez chapeau, lunettes, crème solaire et eau. Les entrées des monuments et le déjeuner restent à votre charge. Le paiement de l’excursion se fait sur place, auprès de votre chauffeur. Envoyez-nous votre demande : nous vous répondons rapidement par e-mail ou par WhatsApp.`,
    related: ['excursion-kairouan', 'friguia-park'],
    highlights: ['Médina et ribat de Sousse', 'Mausolée de Habib Bourguiba', 'Marina de Port El Kantaoui', 'Peu de route, idéal en famille'],
    included: ['Véhicule privé climatisé avec chauffeur', 'Prise en charge à votre hôtel et retour', 'Siège enfant sur demande'],
    notIncluded: ['Entrées des monuments', 'Déjeuner'],
    toBring: [GOOD_SHOES, 'Tenue couvrant épaules et genoux pour le mausolée', SUN, 'Bouteille d’eau'],
    program: [['09:00', 'Prise en charge, marina de Port El Kantaoui'], ['Fin de matinée', 'Sousse : ribat, Grande Mosquée et souks'], ['Midi', 'Déjeuner libre'], ['Après-midi', 'Monastir : ribat, mausolée Bourguiba et marina'], ['19:00', 'Retour']],
    faq: [['Est-ce adapté aux enfants ?', 'Oui : les étapes sont courtes et les trajets rapides. Attention seulement aux escaliers des tours.']],
    images: [img('sousseMedina', 'Médina de Sousse, excursion Sousse Monastir')],
    stops: stops('kantaoui', 'sousse', 'monastir'),
    seo: {
      focusKeyword: 'excursion sousse monastir',
      metaTitle: 'Excursion Sousse Monastir et Port El Kantaoui en privé',
      metaDescription: 'Excursion Sousse Monastir en véhicule privé : marina de Port El Kantaoui, médina et ribat de Sousse, mausolée Bourguiba. Journée facile en famille.',
      h1: 'Excursion Sousse Monastir : le meilleur du Sahel',
    },
  },
];
