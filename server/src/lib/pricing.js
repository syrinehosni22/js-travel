/**
 * Moteur de prix partagé — cahier des charges §3 et §4.3.
 *
 * Utilisé :
 *  - par le site (affichage instantané sur la fiche, sans rechargement) ;
 *  - par l'API, qui RECALCULE le prix à l'enregistrement de la réservation
 *    (le prix envoyé par le navigateur est ignoré) et le fige dans la réservation.
 *
 * Excursions :
 *   Base  = max(M, Σ p_t · n_t)
 *   Total = (Base + S_zone + S_langue + Σ P_o · q_o) × (1 − r)
 *   Affichage = Total × τ_devise   (la réservation enregistre le total en EUR)
 */

export const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

/* ------------------------------------------------------------------ */
/* Saisons                                                              */
/* ------------------------------------------------------------------ */

/**
 * calendar = {
 *   seasons: [{ name: 'high', from: '07-01', to: '08-31' }, ...],  // MM-DD, peut chevaucher l'année
 *   holidays: ['2026-12-25', ...],   // traités comme haute saison
 *   blocked:  ['2026-12-31', ...],   // dates fermées pour tout le site
 * }
 * Retourne 'low' | 'mid' | 'high'. Par défaut : 'mid'.
 */
export function seasonFor(dateStr, calendar = {}) {
  if (!dateStr) return 'mid';
  const iso = String(dateStr).slice(0, 10);
  if ((calendar.holidays || []).includes(iso)) return 'high';
  const md = iso.slice(5);
  for (const s of calendar.seasons || []) {
    const inRange = s.from <= s.to ? md >= s.from && md <= s.to : md >= s.from || md <= s.to;
    if (inRange) return s.name;
  }
  return 'mid';
}

export const isWeekend = (dateStr) => {
  const d = new Date(String(dateStr).slice(0, 10) + 'T12:00:00Z').getUTCDay();
  return d === 0 || d === 6;
};

/* ------------------------------------------------------------------ */
/* Remises                                                              */
/* ------------------------------------------------------------------ */

/**
 * Calcule le taux de remise r. Les remises ne se cumulent pas :
 * la plus avantageuse pour le client s'applique (règle modifiable ici).
 * promo   = { code, percent: 10, active, validFrom, validTo, minAmount, appliesTo: [] }
 * early   = { daysBefore: 30, percent: 5 }
 * partner = { percent: 8 }   // tarif hôtel / agence
 */
export function discountRate({ promo, early, partner, date, today = new Date(), productId, roundTrip } = {}) {
  const candidates = [];
  if (promo && promo.active !== false) {
    const okProduct = !promo.appliesTo || promo.appliesTo.length === 0 || promo.appliesTo.map(String).includes(String(productId));
    const now = today.toISOString().slice(0, 10);
    const okDate = (!promo.validFrom || now >= String(promo.validFrom).slice(0, 10)) && (!promo.validTo || now <= String(promo.validTo).slice(0, 10));
    if (okProduct && okDate) candidates.push({ source: 'promo', code: promo.code, rate: promo.percent / 100 });
  }
  if (early && date) {
    const days = (new Date(date) - today) / 86400000;
    if (days >= early.daysBefore) candidates.push({ source: 'early', rate: early.percent / 100 });
  }
  if (partner) candidates.push({ source: 'partner', rate: partner.percent / 100 });
  if (roundTrip) candidates.push({ source: 'roundtrip', rate: roundTrip / 100 });
  if (!candidates.length) return { rate: 0, source: null };
  return candidates.reduce((a, b) => (b.rate > a.rate ? b : a));
}

/* ------------------------------------------------------------------ */
/* Excursions                                                           */
/* ------------------------------------------------------------------ */

/**
 * excursion.pricing = {
 *   mode: 'per_person' | 'minimum' | 'per_count' | 'per_vehicle' | 'group_flat' | 'quote',
 *   byCount: [{ n: 1, price: 120 }, { n: 2, price: 70 }, ...],  // mode per_count : prix / pers. selon la taille du groupe
 *   seasons: { low: { minimum, adult }, mid: {...}, high: {...} },   // M et p par saison
 *   childDiscount: 0,    infantDiscount: 0,   // réductions sur le prix réduit (1 = gratuit)
 *   childAges: [4, 11],  infantAges: [0, 3],
 *   vehicle: { capacity: 7, price: 90 },       // mode per_vehicle (prix par saison possible via seasons.x.vehicle)
 *   flat: { upTo: 6, price: 300, extraPerPerson: 40 },
 *   maxGroup: 8,
 *   weekendSupplement: 0,                      // % sur la base
 *   zones: [{ key: 'hammamet', label, fee: 10 }],
 *   guideLanguages: [{ lang: 'de', fee: 20 }],
 *   options: [{ key: 'lunch', label, price: 15, per: 'person' | 'vehicle' | 'booking' }],
 *   guideOption: { enabled: true, price: 30, per: 'booking' | 'person' | 'vehicle' },   // guide en option, coché par le client
 *   cityTransfers: [{ city: 'Nabeul', price: 40, per: 'booking' | 'person' | 'vehicle' }], // hôtel hors des villes de départ
 * }
 * booking = { date, participants: { adult, child, infant }, zone, guideLang, options: ['lunch'], guide: true, city: 'Nabeul' }
 * ctx = { calendar, discount: { rate, source }, rate: 1, currency: 'EUR' }
 */
/** Mode « selon le nombre de personnes » : lignes valides, triées par nombre de personnes. */
export function countTable(pr = {}) {
  return (pr.byCount || [])
    .filter((r) => r && +r.n > 0 && r.price !== '' && r.price != null && !Number.isNaN(+r.price))
    .map((r) => ({ n: +r.n, price: +r.price }))
    .sort((a, b) => a.n - b.n);
}

/** Prix par personne pour un groupe de n personnes (ligne la plus proche en dessous si n n'est pas renseigné). */
export function priceForCount(pr, n) {
  const rows = countTable(pr);
  if (!rows.length) return null;
  let best = rows[0];
  for (const r of rows) if (r.n <= n) best = r;
  return best.price;
}

/** Nombre maximum de personnes : dernière ligne du tableau en mode per_count, sinon maxGroup. */
export function capacityOf(excursion) {
  const pr = excursion?.pricing || {};
  if (pr.mode === 'per_count') {
    const rows = countTable(pr);
    if (rows.length) return rows[rows.length - 1].n;
  }
  return pr.maxGroup;
}

const normCity = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_']/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Transfert depuis la ville de l'hôtel du client.
 * null = pas de transfert (ville de départ de l'excursion ou zone de prise en charge) ;
 * { onRequest: true } = ville hors liste, prix confirmé par l'équipe ; sinon { city, price, per }.
 */
export function cityTransferFor(excursion, city) {
  const c = normCity(city);
  if (!c) return null;
  const pr = excursion?.pricing || {};
  const local = [...(excursion?.departureCities || []), ...(pr.zones || []).flatMap((z) => [z.key, z.label])].map(normCity);
  if (local.includes(c)) return null;
  const row = (pr.cityTransfers || []).find((r) => r && normCity(r.city) === c);
  if (!row || !(+row.price > 0)) return { city: String(city).trim(), onRequest: true };
  return { city: row.city, price: +row.price, per: ['person', 'vehicle'].includes(row.per) ? row.per : 'booking' };
}

/** Option guide proposée sur l'excursion (null si non proposée). */
export function guideOptionOf(excursion) {
  const g = excursion?.pricing?.guideOption;
  return g && g.enabled && +g.price > 0 ? { price: +g.price, per: ['person', 'vehicle'].includes(g.per) ? g.per : 'booking' } : null;
}

export function computeExcursionPrice(excursion, booking, ctx = {}) {
  const pr = excursion.pricing || {};
  const p = booking.participants || {};
  const adult = +p.adult || 0, child = +p.child || 0, infant = +p.infant || 0;
  const n = adult + child + infant;
  const payers = adult + child;
  const season = seasonFor(booking.date, ctx.calendar);
  const s = (pr.seasons && (pr.seasons[season] || pr.seasons.mid)) || {};
  const lines = [];
  const result = {
    season, participants: n, payers, lines,
    quote: false, overCapacity: false, belowThreshold: false, missing: 0, threshold: null,
    currency: ctx.currency || 'EUR',
  };

  if (pr.mode === 'quote') return { ...result, quote: true };
  if (n === 0 || adult === 0) return { ...result, error: 'NO_ADULT' };
  const cap = capacityOf(excursion);
  if (cap && n > cap) return { ...result, quote: true, overCapacity: true };

  const pAdult = +s.adult || 0;
  const pChild = round2(pAdult * (1 - (pr.childDiscount ?? 0)));
  const pInfant = round2(pAdult * (1 - (pr.infantDiscount ?? 0)));
  let base = 0;
  let unitPrice = pAdult;
  let vehicles = Math.ceil(n / ((pr.vehicle && pr.vehicle.capacity) || 8));

  switch (pr.mode) {
    case 'per_person':
    case 'minimum': {
      const sum = adult * pAdult + child * pChild + infant * pInfant;
      lines.push({ key: 'adult', qty: adult, unit: pAdult, amount: round2(adult * pAdult) });
      if (child) lines.push({ key: 'child', qty: child, unit: pChild, amount: round2(child * pChild) });
      if (infant) lines.push({ key: 'infant', qty: infant, unit: pInfant, amount: round2(infant * pInfant) });
      base = sum;
      if (pr.mode === 'minimum' && s.minimum) {
        const M = +s.minimum;
        result.threshold = pAdult ? Math.ceil(M / pAdult) : null;
        if (sum < M) {
          base = M;
          result.belowThreshold = true;
          result.missing = pAdult ? Math.ceil((M - sum) / pAdult) : 0;
          lines.length = 0;
          lines.push({ key: 'minimum', qty: payers, amount: round2(M) });
        }
      }
      break;
    }
    case 'per_count': {
      const unit = priceForCount(pr, n);
      if (unit == null) return { ...result, quote: true };
      unitPrice = unit;
      const uc = round2(unit * (1 - (pr.childDiscount ?? 0)));
      const ui = round2(unit * (1 - (pr.infantDiscount ?? 0)));
      lines.push({ key: 'adult', qty: adult, unit, amount: round2(adult * unit) });
      if (child) lines.push({ key: 'child', qty: child, unit: uc, amount: round2(child * uc) });
      if (infant) lines.push({ key: 'infant', qty: infant, unit: ui, amount: round2(infant * ui) });
      base = adult * unit + child * uc + infant * ui;
      // Prochain palier moins cher (« dès 4 personnes : 55 € / pers. »)
      const next = countTable(pr).find((r) => r.n > n && r.price < unit);
      if (next) result.nextTier = { n: next.n, price: next.price, missing: next.n - n };
      break;
    }
    case 'per_vehicle': {
      const price = (s.vehicle ?? pr.vehicle?.price) || 0;
      base = vehicles * price;
      lines.push({ key: 'vehicle', qty: vehicles, unit: price, amount: round2(base) });
      break;
    }
    case 'group_flat': {
      const f = pr.flat || {};
      const flatPrice = s.flat ?? f.price ?? 0;
      const extra = Math.max(0, payers - (f.upTo || 0));
      base = flatPrice + extra * (f.extraPerPerson || 0);
      lines.push({ key: 'flat', qty: 1, unit: flatPrice, amount: round2(flatPrice) });
      if (extra) lines.push({ key: 'extra', qty: extra, unit: f.extraPerPerson, amount: round2(extra * f.extraPerPerson) });
      break;
    }
    default:
      return { ...result, error: 'UNKNOWN_MODE' };
  }

  if (pr.weekendSupplement && booking.date && isWeekend(booking.date)) {
    const w = round2(base * pr.weekendSupplement / 100);
    lines.push({ key: 'weekend', amount: w });
    base += w;
  }

  // Supplément de zone de prise en charge
  const zone = (pr.zones || []).find((z) => z.key === booking.zone);
  if (zone && zone.fee) lines.push({ key: 'zone', label: zone.label || zone.key, amount: round2(zone.fee) });
  const zoneFee = zone ? +zone.fee || 0 : 0;

  // Supplément langue du guide
  const lang = (pr.guideLanguages || []).find((l) => l.lang === booking.guideLang);
  const langFee = lang ? +lang.fee || 0 : 0;
  if (langFee) lines.push({ key: 'language', label: lang.lang, amount: round2(langFee) });

  // Options : par personne (payants), par véhicule ou par réservation
  let optionsTotal = 0;
  for (const key of booking.options || []) {
    const o = (pr.options || []).find((x) => x.key === key);
    if (!o) continue;
    const q = o.per === 'person' ? payers : o.per === 'vehicle' ? vehicles : 1;
    const amount = round2(o.price * q);
    optionsTotal += amount;
    const label = o.label && typeof o.label === 'object' ? (o.label[ctx.lang] || o.label.en || o.label.fr || o.key) : o.label;
    lines.push({ key: 'option', option: o.key, label, qty: q, unit: o.price, amount });
  }

  // Guide en option (case cochée par le client) et transfert depuis une autre ville
  let extrasTotal = 0;
  const qtyFor = (per) => (per === 'person' ? payers : per === 'vehicle' ? vehicles : 1);
  const guide = booking.guide ? guideOptionOf(excursion) : null;
  if (guide) {
    const q = qtyFor(guide.per), amount = round2(guide.price * q);
    extrasTotal += amount;
    lines.push({ key: 'guide', per: guide.per, qty: q, unit: guide.price, amount });
  }
  const ct = cityTransferFor(excursion, booking.city);
  if (ct?.onRequest) result.cityTransferOnRequest = ct.city;
  else if (ct) {
    const q = qtyFor(ct.per), amount = round2(ct.price * q);
    extrasTotal += amount;
    lines.push({ key: 'cityTransfer', label: ct.city, per: ct.per, qty: q, unit: ct.price, amount });
  }

  const subtotal = round2(base + zoneFee + langFee + optionsTotal + extrasTotal);
  const d = ctx.discount || { rate: 0 };
  const discountAmount = round2(subtotal * (d.rate || 0));
  if (discountAmount) lines.push({ key: 'discount', source: d.source, code: d.code, rate: d.rate, amount: -discountAmount });

  const totalEur = round2(subtotal - discountAmount);
  const fx = ctx.rate || 1;
  return {
    ...result,
    vehicles,
    subtotalEur: subtotal,
    totalEur,
    total: round2(totalEur * fx),
    perPerson: payers ? round2((totalEur * fx) / payers) : 0,
    unitReducedPrice: unitPrice,
  };
}

/** Tableau « seuil et prix par taille de groupe » affiché dans l'admin (§3.6). */
export function groupTable(excursion, season = 'mid', max = capacityOf(excursion) || 8) {
  const rows = [];
  for (let n = 1; n <= max; n++) {
    const r = computeExcursionPrice(excursion, { participants: { adult: n } }, { calendar: { seasons: [{ name: season, from: '01-01', to: '12-31' }] } });
    rows.push({ n, base: r.subtotalEur, perPerson: r.perPerson, minimumApplied: r.belowThreshold });
  }
  return rows;
}

/** Alerte admin : minimum inatteignable avec la capacité maximale (§3.2 bis). */
export function minimumWarnings(excursion) {
  const pr = excursion.pricing || {};
  if (pr.mode !== 'minimum') return [];
  const cap = pr.maxGroup || 8;
  return Object.entries(pr.seasons || {})
    .filter(([, s]) => s && s.minimum && s.adult * cap < s.minimum)
    .map(([season, s]) => ({ season, message: `p × capacité (${s.adult} × ${cap}) < minimum (${s.minimum})` }));
}

/** Prix « à partir de » pour les cartes du catalogue : prix réduit + seuil. */
export function fromPrice(excursion, season = 'mid') {
  const pr = excursion.pricing || {};
  // Prix choisi dans l'admin pour la carte : prioritaire sur le calcul automatique
  const cp = pr.cardPrice;
  if (cp && cp.amount != null && cp.amount !== '' && +cp.amount > 0) {
    return { amount: +cp.amount, per: ['person', 'group', 'vehicle'].includes(cp.per) ? cp.per : 'person', from: +cp.from > 1 ? +cp.from : null, custom: true };
  }
  const s = (pr.seasons && (pr.seasons[season] || pr.seasons.mid)) || {};
  if (pr.mode === 'quote') return { quote: true };
  if (pr.mode === 'per_vehicle') return { amount: s.vehicle ?? pr.vehicle?.price, per: 'vehicle' };
  if (pr.mode === 'per_count') {
    const rows = countTable(pr);
    if (!rows.length) return { quote: true };
    const best = rows.reduce((a, b) => (b.price < a.price ? b : a));
    return { amount: best.price, per: 'person', from: best.n > 1 ? best.n : null };
  }
  if (pr.mode === 'group_flat') return { amount: s.flat ?? pr.flat?.price, per: 'group', upTo: pr.flat?.upTo };
  return { amount: s.adult, per: 'person', from: pr.mode === 'minimum' && s.adult ? Math.ceil(s.minimum / s.adult) : null };
}

/* ------------------------------------------------------------------ */
/* Transferts                                                           */
/* ------------------------------------------------------------------ */

/**
 * grid = [{ fromZone, toZone, vehicle: 'sedan', price }]  (symétrique)
 * vehicles = [{ key: 'sedan', label, maxPassengers: 3, maxLuggage: 3, perKm, minFare }]
 * supplements = { nightPercent: 20, nightFrom: 22, nightTo: 6, childSeat: 5, nameSign: 5, extraStop: 10, waitingPerHour: 15 }
 * request = { fromZone, toZone, distanceKm?, datetime, passengers: {adult, child, infant}, luggage,
 *             childSeats, nameSign, extraStops, roundTrip, returnDatetime }
 */
/** Libellé du transport de groupe proposé sur demande */
export const GROUP_LABEL = { fr: 'Minibus ou autocar (groupe)', en: 'Minibus or coach (group)', de: 'Kleinbus oder Reisebus (Gruppe)', it: 'Minibus o pullman (gruppo)', es: 'Minibús o autocar (grupo)' };

export function computeTransferQuotes({ grid = [], vehicles = [], supplements = {}, returnDiscount = 0, groups = {} }, request, ctx = {}) {
  const pax = (request.passengers?.adult || 0) + (request.passengers?.child || 0) + (request.passengers?.infant || 0);
  // Groupes : au-delà de « onRequestAbove » passagers (20 par défaut), prix sur demande ; maximum « maxPassengers » (50)
  const above = groups.onRequestAbove ?? 20;
  const max = groups.maxPassengers ?? 50;
  if (pax > max) return [];
  if (pax > above) return [{ vehicle: 'group', label: GROUP_LABEL, minPassengers: above + 1, maxPassengers: max, onRequest: true, group: true, lines: [], totalEur: null, total: null, night: false }];
  const luggage = +request.luggage || 0;
  const hour = request.datetime ? new Date(request.datetime).getHours() : 12;
  const nf = supplements.nightFrom ?? 22, nt = supplements.nightTo ?? 6;
  const isNight = (h) => (nf > nt ? h >= nf || h < nt : h >= nf && h < nt);
  const fx = ctx.rate || 1;

  const findPrice = (vehicle) => {
    const row = grid.find((g) => g.vehicle === vehicle.key && ((g.fromZone === request.fromZone && g.toZone === request.toZone) || (g.fromZone === request.toZone && g.toZone === request.fromZone)));
    if (row) return row.price;
    if (request.distanceKm && vehicle.perKm) return Math.max(vehicle.minFare || 0, round2(request.distanceKm * vehicle.perKm));
    return null;
  };

  return vehicles
    // Chaque véhicule couvre une tranche de passagers (ex. berline 1–4, minivan 5–8, minibus 9 et plus)
    .filter((v) => pax >= (v.minPassengers || 1) && v.maxPassengers >= pax && (v.maxLuggage == null || v.maxLuggage >= luggage))
    .map((v) => {
      // Véhicule « sur demande » (ex. VIP) : proposé sans prix, le client demande un devis
      if (v.onRequest) return { vehicle: v.key, label: v.label, minPassengers: v.minPassengers || 1, maxPassengers: v.maxPassengers, maxLuggage: v.maxLuggage, onRequest: true, lines: [], totalEur: null, total: null, night: isNight(hour) };
      const basePrice = findPrice(v);
      if (basePrice == null) return null;
      const lines = [{ key: 'route', amount: basePrice }];
      let oneWay = basePrice;
      if (isNight(hour) && supplements.nightPercent) {
        const s = round2(basePrice * supplements.nightPercent / 100);
        lines.push({ key: 'night', amount: s }); oneWay += s;
      }
      const add = (key, qty, unit) => { if (qty && unit) { const a = round2(qty * unit); lines.push({ key, qty, unit, amount: a }); oneWay += a; } };
      add('childSeat', request.childSeats, supplements.childSeat);
      add('nameSign', request.nameSign ? 1 : 0, supplements.nameSign);
      add('extraStop', request.extraStops, supplements.extraStop);

      let total = oneWay;
      if (request.roundTrip) {
        let back = basePrice;
        const rh = request.returnDatetime ? new Date(request.returnDatetime).getHours() : 12;
        if (isNight(rh) && supplements.nightPercent) back += round2(basePrice * supplements.nightPercent / 100);
        const disc = round2(back * (returnDiscount / 100));
        lines.push({ key: 'return', amount: round2(back) });
        if (disc) lines.push({ key: 'returnDiscount', rate: returnDiscount / 100, amount: -disc });
        total += back - disc;
      }
      const d = ctx.discount || { rate: 0 };
      const da = round2(total * (d.rate || 0));
      if (da) { lines.push({ key: 'discount', source: d.source, amount: -da }); total -= da; }
      const totalEur = round2(total);
      return { vehicle: v.key, label: v.label, minPassengers: v.minPassengers || 1, maxPassengers: v.maxPassengers, maxLuggage: v.maxLuggage, lines, totalEur, total: round2(totalEur * fx), night: isNight(hour) };
    })
    .filter(Boolean)
    // Prix croissants ; les véhicules « sur demande » en dernier
    .sort((a, b) => (!!a.onRequest - !!b.onRequest) || ((a.totalEur ?? 0) - (b.totalEur ?? 0)));
}

/* ------------------------------------------------------------------ */
/* Format                                                               */
/* ------------------------------------------------------------------ */

const LOCALES = { fr: 'fr-FR', en: 'en-GB', de: 'de-DE', it: 'it-IT', es: 'es-ES' };
export function formatMoney(value, currency = 'EUR', lang = 'fr', digits = 2) {
  return new Intl.NumberFormat(LOCALES[lang] || lang, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
