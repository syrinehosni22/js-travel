import { computeExcursionPrice, computeTransferQuotes, discountRate, round2 } from '@tt/shared';
import { Booking, Excursion, Promo, Partner, TransferConfig, Location, Customer } from '../models/index.js';
import { getSettings, rateFor } from './settings.js';

export class HttpError extends Error {
  constructor(status, code, message, details) { super(message || code); this.status = status; this.code = code; this.details = details; }
}

/** Remise applicable : code promo, réservation anticipée ou tarif partenaire (la meilleure). */
export async function resolveDiscount({ promoCode, partnerCode, date, productId }) {
  const s = await getSettings();
  let promo = null, partner = null;
  if (promoCode) {
    promo = await Promo.findOne({ code: String(promoCode).toUpperCase().trim(), active: true }).lean();
    if (promo && promo.maxUses && promo.uses >= promo.maxUses) promo = null;
  }
  if (partnerCode) {
    const p = await Partner.findOne({ trackingCode: partnerCode }).lean();
    if (p && p.discountPercent) partner = { percent: p.discountPercent, id: p._id };
  }
  const d = discountRate({ promo, early: s.earlyBooking?.daysBefore ? s.earlyBooking : null, partner, date, productId });
  return { ...d, code: d.source === 'promo' ? promo.code : undefined, partnerId: partner?.id };
}

/* ---------------- Disponibilités (§5.4) ---------------- */

export async function bookedGroups(excursionId, date) {
  return Booking.countDocuments({
    status: { $nin: ['cancelled'] },
    items: { $elemMatch: { excursion: excursionId, date, status: { $ne: 'cancelled' } } },
  });
}

export async function checkAvailability(excursion, date) {
  const s = await getSettings();
  const a = excursion.availability || {};
  if (!date) return { available: false, reason: 'NO_DATE' };
  const d = new Date(date + 'T12:00:00Z');
  const hoursAhead = (new Date(date + 'T08:00:00') - Date.now()) / 3600000;
  if (hoursAhead < (a.minNoticeHours ?? 24)) return { available: false, reason: 'TOO_LATE' };
  if ((s.calendar?.blocked || []).includes(date) || (a.blockedDates || []).includes(date)) return { available: false, reason: 'CLOSED' };
  if ((a.closedWeekdays || []).includes(d.getUTCDay())) return { available: false, reason: 'CLOSED' };
  const used = await bookedGroups(excursion._id, date);
  const left = (a.capacityPerDay ?? 3) - used;
  return left > 0 ? { available: true, left, mode: a.mode } : { available: false, reason: 'FULL', waitlist: true };
}

/** Calendrier d'un mois : statut de chaque jour (pour le sélecteur de date). */
export async function monthAvailability(excursion, month) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const from = `${month}-01`, to = `${month}-${String(days).padStart(2, '0')}`;
  const counts = await Booking.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    { $match: { 'items.excursion': excursion._id, 'items.date': { $gte: from, $lte: to }, 'items.status': { $ne: 'cancelled' } } },
    { $group: { _id: '$items.date', n: { $sum: 1 } } },
  ]);
  const used = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  const s = await getSettings();
  const a = excursion.availability || {};
  const out = {};
  for (let i = 1; i <= days; i++) {
    const date = `${month}-${String(i).padStart(2, '0')}`;
    const wd = new Date(date + 'T12:00:00Z').getUTCDay();
    const tooLate = (new Date(date + 'T08:00:00') - Date.now()) / 3600000 < (a.minNoticeHours ?? 24);
    if (tooLate) out[date] = 'past';
    else if ((s.calendar?.blocked || []).includes(date) || (a.blockedDates || []).includes(date) || (a.closedWeekdays || []).includes(wd)) out[date] = 'closed';
    else if ((used[date] || 0) >= (a.capacityPerDay ?? 3)) out[date] = 'full';
    else out[date] = 'open';
  }
  return out;
}

/* ---------------- Prix (recalcul serveur, §3.5) ---------------- */

export async function priceExcursionItem(item, { promoCode, partnerCode, currency = 'EUR', lang = 'en' } = {}) {
  const exc = await Excursion.findById(item.excursion).lean();
  if (!exc || !exc.published) throw new HttpError(404, 'EXCURSION_NOT_FOUND');
  const s = await getSettings();
  const discount = await resolveDiscount({ promoCode, partnerCode, date: item.date, productId: exc._id });
  const rate = (await rateFor(currency)) || 1;
  const price = computeExcursionPrice(exc, item, { calendar: s.calendar, discount, rate, currency, lang });
  return { exc, price, discount };
}

export async function transferQuotes(request, { promoCode, currency = 'EUR' } = {}) {
  const cfg = await TransferConfig.findOne().lean();
  if (!cfg) throw new HttpError(500, 'TRANSFERS_NOT_CONFIGURED');
  const [from, to] = await Promise.all([
    request.fromId ? Location.findById(request.fromId).lean() : null,
    request.toId ? Location.findById(request.toId).lean() : null,
  ]);
  const fromZone = from?.zone || request.fromZone;
  const toZone = to?.zone || request.toZone;
  if (!fromZone || !toZone) throw new HttpError(400, 'UNKNOWN_PLACE');
  if (request.datetime && (new Date(request.datetime) - Date.now()) / 3600000 < (cfg.minNoticeHours ?? 12)) {
    throw new HttpError(400, 'TOO_LATE', undefined, { hours: cfg.minNoticeHours ?? 12 });
  }
  const discount = await resolveDiscount({ promoCode, date: request.datetime });
  const rate = (await rateFor(currency)) || 1;
  const vehicles = cfg.vehicles.map((v) => ({ ...v, label: v.label }));
  const quotes = computeTransferQuotes({ grid: cfg.grid, vehicles, supplements: cfg.supplements, returnDiscount: cfg.returnDiscount },
    { ...request, fromZone, toZone }, { discount, rate });
  return { quotes, from, to, fromZone, toZone, minNoticeHours: cfg.minNoticeHours };
}

/**
 * Crée une réservation à partir du panier. Chaque ligne est re-tarifée côté serveur ;
 * le total envoyé par le navigateur n'est jamais utilisé.
 */
export async function createBooking({ items, customer, promoCode, partnerCode, currency = 'EUR', lang = 'en', consent, ip }) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'EMPTY_CART');
  if (!consent?.cancellation) throw new HttpError(400, 'CONSENT_REQUIRED');

  const acct = await Customer.findOne({ email: customer.email.toLowerCase() });
  if (acct?.blocked) throw new HttpError(403, 'CUSTOMER_BLOCKED');

  const rate = (await rateFor(currency)) || 1;
  const out = [];
  let totalEur = 0;
  let allInstant = true;

  for (const it of items) {
    if (it.type === 'excursion') {
      const { exc, price } = await priceExcursionItem(it, { promoCode, partnerCode, currency, lang });
      if (price.quote || price.error) throw new HttpError(400, 'QUOTE_ONLY', undefined, { excursion: exc._id });
      const avail = await checkAvailability(exc, it.date);
      if (!avail.available) throw new HttpError(409, avail.reason, undefined, { excursion: exc._id, date: it.date });
      if (avail.mode !== 'instant') allInstant = false;
      out.push({
        type: 'excursion', excursion: exc._id, title: exc.title?.[lang] || exc.title?.en,
        date: it.date, time: it.time, participants: it.participants, zone: it.zone, guideLang: it.guideLang, options: it.options,
        season: price.season, lines: price.lines, totalEur: price.totalEur,
        status: avail.mode === 'instant' ? 'confirmed' : 'pending',
      });
      totalEur += price.totalEur;
    } else if (it.type === 'transfer') {
      const t = it.transfer || {};
      const { quotes, from, to } = await transferQuotes({ ...t, passengers: it.participants }, { promoCode, currency });
      const q = quotes.find((x) => x.vehicle === t.vehicle);
      if (!q) throw new HttpError(400, 'VEHICLE_UNAVAILABLE');
      allInstant = false;
      const fromName = from?.label?.[lang] || from?.name || t.from;
      const toName = to?.label?.[lang] || to?.name || t.to;
      out.push({
        type: 'transfer', title: `${fromName} → ${toName}`, participants: it.participants,
        date: String(t.datetime).slice(0, 10), time: String(t.datetime).slice(11, 16),
        transfer: { ...t, from: fromName, to: toName, fromZone: from?.zone, toZone: to?.zone },
        lines: q.lines, totalEur: q.totalEur, status: 'pending',
      });
      totalEur += q.totalEur;
    } else throw new HttpError(400, 'BAD_ITEM');
  }

  totalEur = round2(totalEur);
  const discount = await resolveDiscount({ promoCode, partnerCode });
  const booking = await Booking.create({
    items: out, customer, lang, currency, rate,
    totalEur, totalDisplay: round2(totalEur * rate),
    promoCode: discount.code, partner: discount.partnerId,
    channel: partnerCode ? 'partner' : 'web',
    status: allInstant ? 'confirmed' : 'new',
    consent: { terms: !!consent.terms, cancellation: true, at: new Date(), ip },
    history: [{ by: 'client', action: 'created' }],
  });
  if (discount.code) await Promo.updateOne({ code: discount.code }, { $inc: { uses: 1 } });
  await Customer.updateOne({ email: customer.email.toLowerCase() }, { $setOnInsert: { name: customer.name, phone: customer.phone, lang } }, { upsert: true });
  return booking;
}

/** Annulation par le client selon la politique (gratuite jusqu'à X h avant). */
export async function canCustomerCancel(booking) {
  const s = await getSettings();
  const first = booking.items.map((i) => (i.transfer?.datetime ? new Date(i.transfer.datetime) : new Date(`${i.date}T${i.time || '08:00'}:00`))).sort((a, b) => a - b)[0];
  const hours = (first - Date.now()) / 3600000;
  return hours >= (s.cancellationHours ?? 24) && !['cancelled', 'completed', 'no_show'].includes(booking.status);
}
