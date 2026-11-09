/**
 * Photos du site — toutes gratuites sous la licence Unsplash (usage commercial autorisé,
 * attribution non obligatoire mais affichée dans le pied de page par courtoisie).
 * Lieux vérifiés sur la page Unsplash de chaque photo.
 *
 * Par défaut les images sont servies par le CDN d'Unsplash (redimensionnées et converties
 * en WebP/AVIF automatiquement). Pour les héberger sur votre serveur :
 *   node scripts/download-images.mjs      puis   VITE_LOCAL_IMAGES=1 npm run build
 */
export const PHOTOS = {
  sidiBouSaidStreet: { id: 'photo-1723579632461-3ba5840fa422', ph: '#2B4A6B', alt: { fr: 'Ruelle blanche et bleue de Sidi Bou Saïd', en: 'White and blue lane in Sidi Bou Said' }, by: 'Mohamed Jamil Latrach', page: 'https://unsplash.com/photos/AeEECoofMRA', place: 'Sidi Bou Saïd' },
  sidiBouSaidSea: { id: 'photo-1607869861980-da5f9b8b4969', ph: '#C7D8EA', alt: { fr: 'Maison blanche face à la mer à Sidi Bou Saïd', en: 'White house facing the sea in Sidi Bou Said' }, by: 'Noelle Guirola', page: 'https://unsplash.com/photos/5NqUXa6pZDM', place: 'Sidi Bou Saïd' },
  sidiBouSaidMosque: { id: 'photo-1726428977596-b5baddb42274', ph: '#C7D8EA', alt: { fr: 'Minaret de Sidi Bou Saïd', en: 'Minaret in Sidi Bou Said' }, by: 'Brahim Guedich', page: 'https://unsplash.com/photos/yCe8u0CaVSc', place: 'Sidi Bou Saïd' },
  carthage: { id: 'photo-1770712857881-2133f72fcab7', ph: '#C7D8EA', alt: { fr: 'Ruines antiques de Carthage face à la mer', en: 'Ancient ruins of Carthage by the sea' }, by: 'Carnet de Voyage d’Alex', page: 'https://unsplash.com/photos/jLAf94h7HmI', place: 'Carthage' },
  ksarGhilane: { id: 'photo-1487060582949-8a4ea9710d16', ph: '#6B4A2B', alt: { fr: 'Dunes du Sahara à Ksar Ghilane', en: 'Sahara dunes at Ksar Ghilane' }, by: 'Jérôme Prax', page: 'https://unsplash.com/photos/EI4VbHrbrK4', place: 'Ksar Ghilane' },
  saharaDune: { id: 'photo-1702400558189-b45379744432', ph: '#EAD3B2', alt: { fr: 'Voyageur au sommet d’une dune du Sahara', en: 'Traveller on top of a Sahara dune' }, by: 'ruedi häberli', page: 'https://unsplash.com/photos/qcRQ2Ehx6Q8', place: 'Sahara' },
  camel: { id: 'photo-1568387380357-ba90334a6541', ph: '#D7D9B8', alt: { fr: 'Dromadaire dans le désert près de Tataouine', en: 'Camel in the desert near Tataouine' }, by: 'Greg Keelen', page: 'https://unsplash.com/photos/KZrumAkJWnQ', place: 'Tataouine' },
  djerbaBeach: { id: 'photo-1598554361597-0858e58aee6f', ph: '#245A57', alt: { fr: 'Plage de Djerba', en: 'Beach in Djerba' }, by: 'Aleksandr Sali', page: 'https://unsplash.com/photos/yoiHCafV7Vw', place: 'Djerba' },
  houmtSouk: { id: 'photo-1745999739673-3fe2220b3d44', ph: '#BFE0DD', alt: { fr: 'Façades bleues à Houmt Souk, Djerba', en: 'Blue facades in Houmt Souk, Djerba' }, by: 'Ondrej Bocek', page: 'https://unsplash.com/photos/i7Vp-3aQOWo', place: 'Djerba' },
  southPalm: { id: 'photo-1620509400919-a2ef8294f239', ph: '#D7D9B8', alt: { fr: 'Palmier et montagne dans le sud tunisien', en: 'Palm tree and mountain in southern Tunisia' }, by: 'Attila Janosi', page: 'https://unsplash.com/photos/xlO4V1RRFIY', place: 'Sud tunisien' },
  elJem: { id: 'photo-1755463083594-8cd2d1e2135e', ph: '#E3C9AE', alt: { fr: 'Amphithéâtre romain d’El Jem', en: 'Roman amphitheatre of El Jem' }, by: 'Amir Haj Ayed', page: 'https://unsplash.com/photos/IpXUVXG_kS4', place: 'El Jem' },
  sousseMedina: { id: 'photo-1568632054492-c5398a6d5405', ph: '#BFE0DD', alt: { fr: 'Voyageurs dans la médina de Sousse', en: 'Travellers in the medina of Sousse' }, by: 'Albert Gubaydullin', page: 'https://unsplash.com/photos/Kpq9dzUDF6s', place: 'Sousse' },
  mahdia: { id: 'photo-1621340677732-65bb864b57ec', ph: '#245A57', alt: { fr: 'Plage de Mahdia au coucher du soleil', en: 'Mahdia beach at sunset' }, by: 'Taha Loukil', page: 'https://unsplash.com/photos/a0TdFHi7RUs', place: 'Mahdia' },
};

/** Textes alternatifs des photos en allemand, italien et espagnol */
const ALT_MORE = {
  carthage: ['Antike Ruinen von Karthago am Meer', 'Rovine antiche di Cartagine sul mare', 'Ruinas antiguas de Cartago junto al mar'],
  sidiBouSaidStreet: ['Weiß-blaue Gasse in Sidi Bou Saïd', 'Vicolo bianco e blu a Sidi Bou Saïd', 'Callejuela blanca y azul en Sidi Bou Saïd'],
  sidiBouSaidSea: ['Weißes Haus am Meer in Sidi Bou Saïd', 'Casa bianca sul mare a Sidi Bou Saïd', 'Casa blanca frente al mar en Sidi Bou Saïd'],
  sidiBouSaidMosque: ['Minarett in Sidi Bou Saïd', 'Minareto a Sidi Bou Saïd', 'Minarete de Sidi Bou Saïd'],
  ksarGhilane: ['Sahara-Dünen bei Ksar Ghilane', 'Dune del Sahara a Ksar Ghilane', 'Dunas del Sáhara en Ksar Ghilane'],
  saharaDune: ['Reisender auf einer Sahara-Düne', 'Viaggiatore in cima a una duna del Sahara', 'Viajero en lo alto de una duna del Sáhara'],
  camel: ['Dromedar in der Wüste bei Tataouine', 'Dromedario nel deserto vicino a Tataouine', 'Dromedario en el desierto cerca de Tataouine'],
  djerbaBeach: ['Strand auf Djerba', 'Spiaggia di Djerba', 'Playa de Yerba'],
  houmtSouk: ['Blaue Fassaden in Houmt Souk, Djerba', 'Facciate blu a Houmt Souk, Djerba', 'Fachadas azules en Houmt Souk, Yerba'],
  southPalm: ['Palme und Berg im Süden Tunesiens', 'Palma e montagna nel sud della Tunisia', 'Palmera y montaña en el sur de Túnez'],
  elJem: ['Römisches Amphitheater von El Jem', 'Anfiteatro romano di El Jem', 'Anfiteatro romano de El Jem'],
  sousseMedina: ['Reisende in der Medina von Sousse', 'Viaggiatori nella medina di Sousse', 'Viajeros en la medina de Susa'],
  mahdia: ['Strand von Mahdia bei Sonnenuntergang', 'Spiaggia di Mahdia al tramonto', 'Playa de Mahdia al atardecer'],
};
for (const [k, [de, it, es]] of Object.entries(ALT_MORE)) if (PHOTOS[k]) Object.assign(PHOTOS[k].alt, { de, it, es });

const LOCAL = import.meta.env?.VITE_LOCAL_IMAGES === '1';
export const WIDTHS = [640, 1024, 1600, 2400];

/** URL d'une photo à une largeur donnée (CDN Unsplash ou copie locale) */
export function photoUrl(key, w = 1600) {
  const p = PHOTOS[key];
  if (!p) return key; // déjà une URL
  if (LOCAL) return `/images/${key}-${w}.jpg`;
  return `https://images.unsplash.com/${p.id}?auto=format&fit=crop&q=75&w=${w}`;
}

/** Retrouve la clé d'une URL Unsplash (utile pour les images stockées en base) */
export function keyFromUrl(url = '') {
  return Object.keys(PHOTOS).find((k) => url.includes(PHOTOS[k].id));
}

/** srcset responsive pour une URL Unsplash ou une clé */
export function srcSet(src) {
  const key = PHOTOS[src] ? src : keyFromUrl(src);
  if (key) return WIDTHS.map((w) => `${photoUrl(key, w)} ${w}w`).join(', ');
  if (/images\.unsplash\.com/.test(src)) {
    const base = src.split('?')[0];
    return WIDTHS.map((w) => `${base}?auto=format&fit=crop&q=75&w=${w} ${w}w`).join(', ');
  }
  return undefined;
}

export const photoAlt = (key, lang) => PHOTOS[key]?.alt?.[lang] || PHOTOS[key]?.alt?.en || '';
