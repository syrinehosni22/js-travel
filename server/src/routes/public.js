import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { fromPrice, seasonFor, computeExcursionPrice } from '../lib/pricing.js';
import { cleanText } from '../services/text.js';
import { Excursion, Location, Zone, TransferConfig, Booking, Message, Post, Waitlist, Redirect, TransferRoute, User } from '../models/index.js';
import { getSettings, rateFor } from '../services/settings.js';
import { priceExcursionItem, transferQuotes, createBooking, checkAvailability, monthAvailability, canCustomerCancel, resolveDiscount, HttpError } from '../services/booking.js';
import { notifyBookingCreated, notifyStatus, sendMail } from '../services/notify.js';
import { voucherPdf } from '../services/voucher.js';
import { antiSpam } from '../middleware.js';
import { LANGS, config } from '../config.js';

const r = Router();
const lang = (req) => (LANGS.includes(req.query.lang) ? req.query.lang : 'en');
const pick = (obj, l) => (obj && (obj[l] || obj.en)) || '';
const formLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

/** Projette une excursion dans une langue (aplatit les champs traduits). */
function localize(e, l, full = false) {
  const base = {
    id: e._id, slug: e.slug?.[l] || e.slug?.en, slugs: e.slug, title: pick(e.title, l), summary: pick(e.summary, l),
    category: e.category, durationHours: e.durationHours, durationLabel: pick(e.durationLabel, l),
    departureCities: e.departureCities, guideLanguages: e.guideLanguages, badges: e.badges,
    image: e.images?.[0] ? { url: e.images[0].url, alt: pick(e.images[0].alt, l) } : null,
    rating: e.rating, from: fromPrice(e, 'mid'), popularity: e.popularity,
  };
  if (!full) return base;
  return {
    ...base,
    description: pick(e.description, l),
    highlights: (e.highlights || []).map((x) => pick(x, l)),
    included: (e.included || []).map((x) => pick(x, l)),
    notIncluded: (e.notIncluded || []).map((x) => pick(x, l)),
    toBring: (e.toBring || []).map((x) => pick(x, l)),
    program: (e.program || []).map((p) => ({ time: p.time, text: pick(p.text, l) })),
    faq: (e.faq || []).map((f) => ({ q: pick(f.q, l), a: pick(f.a, l) })),
    images: (e.images || []).map((i) => ({ url: i.url, alt: pick(i.alt, l) })),
    itinerary: e.itinerary?.enabled !== false && (e.itinerary?.stops || []).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng)).length >= 2 ? {
      stops: e.itinerary.stops.filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng)).map((x) => ({ name: pick(x.name, l), note: pick(x.note, l), lat: x.lat, lng: x.lng })),
      path: e.itinerary.path?.length > 1 ? e.itinerary.path : null,
    } : null,
    video: e.video, mapEmbed: e.mapEmbed, minAge: e.minAge, groupSize: e.groupSize, startTimes: e.startTimes,
    cancellationFreeHours: e.cancellationFreeHours,
    availability: { mode: e.availability?.mode, confirmWithinHours: e.availability?.confirmWithinHours },
    // Règles de prix publiques : le navigateur calcule l'affichage instantané, le serveur recalcule à la réservation.
    pricing: { ...e.pricing, options: (e.pricing?.options || []).map((o) => ({ ...o, label: pick(o.label, l) })) },
    seo: e.seo?.[l] || {},
  };
}

/* ---------- Paramètres publics ---------- */
r.get('/settings', async (req, res) => {
  const s = await getSettings();
  const l = lang(req);
  res.json({
    calendar: s.calendar, contact: s.contact, social: s.social, reviews: s.reviews,
    cancellationHours: s.cancellationHours, fx: { EUR: 1, GBP: s.fx?.GBP, TND: s.fx?.TND },
    faq: (s.faq || []).map((f) => ({ q: pick(f.q, l), a: pick(f.a, l) })),
    seoHome: s.seoHome?.[l] || {},
    home: {
      hero: { title: pick(s.home?.hero?.title, l), text: pick(s.home?.hero?.text, l), slides: (s.home?.hero?.slides || []).filter(Boolean) },
      banner: { enabled: s.home?.banner?.enabled !== false, title: pick(s.home?.banner?.title, l), text: pick(s.home?.banner?.text, l), button: pick(s.home?.banner?.button, l), target: s.home?.banner?.target || 'transfers' },
      destinationsTitle: pick(s.home?.destinationsTitle, l),
      destinations: (s.home?.destinations || []).filter((d) => d.image && pick(d.name, l)).map((d) => ({ name: pick(d.name, l), image: d.image, category: d.category || '', q: d.q || '' })),
    },
    about: s.about?.enabled === false ? { enabled: false } : {
      enabled: true,
      title: pick(s.about?.title, l), text: pick(s.about?.text, l),
      image: s.about?.image || '', video: s.about?.video || '',
      stats: (s.about?.stats || []).filter((x) => x.value).map((x) => ({ value: x.value, label: pick(x.label, l) })),
    },
  });
});

r.get('/legal/:key', async (req, res) => {
  const s = await getSettings();
  const doc = s.legal?.[req.params.key];
  if (!doc) throw new HttpError(404, 'NOT_FOUND');
  res.json({ body: pick(doc, lang(req)) });
});

/* ---------- Catalogue (§5.1) ---------- */
r.get('/excursions', async (req, res) => {
  const l = lang(req);
  const q = { published: true, publishedLangs: l };
  if (req.query.category) q.category = req.query.category;
  if (req.query.city) q.departureCities = req.query.city;
  if (req.query.guideLang) q.guideLanguages = req.query.guideLang;
  if (req.query.maxHours) q.durationHours = { $lte: +req.query.maxHours };
  if (req.query.q) q.$text = { $search: String(req.query.q) };
  let list = await Excursion.find(q).lean();
  let out = list.map((e) => localize(e, l));
  if (req.query.maxPrice) out = out.filter((e) => e.from.amount != null && e.from.amount <= +req.query.maxPrice);
  const sort = req.query.sort || 'popularity';
  const sorters = {
    popularity: (a, b) => (b.popularity || 0) - (a.popularity || 0),
    price: (a, b) => (a.from.amount ?? 1e9) - (b.from.amount ?? 1e9),
    duration: (a, b) => (a.durationHours || 0) - (b.durationHours || 0),
  };
  out.sort(sorters[sort] || sorters.popularity);
  res.json(out);
});

r.get('/excursions/:slug', async (req, res) => {
  const l = lang(req);
  const slug = req.params.slug;
  let e = await Excursion.findOne({ [`slug.${l}`]: slug, published: true }).lean();
  if (!e) {
    e = await Excursion.findOne({ $or: [{ 'slugHistory.slug': slug }, ...LANGS.map((x) => ({ [`slug.${x}`]: slug }))], published: true }).lean();
    if (e) return res.json({ redirect: e.slug?.[l] || e.slug?.en }); // le front fait la redirection (301 côté serveur via /r)
    throw new HttpError(404, 'NOT_FOUND');
  }
  const related = await Excursion.find({ _id: { $ne: e._id }, published: true, publishedLangs: l, $or: [{ category: e.category }, { departureCities: { $in: e.departureCities } }] }).limit(3).lean();
  res.json({ ...localize(e, l, true), related: related.map((x) => localize(x, l)) });
});

r.get('/excursions/:id/availability', async (req, res) => {
  const e = await Excursion.findById(req.params.id).lean();
  if (!e) throw new HttpError(404, 'NOT_FOUND');
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
  res.json(await monthAvailability(e, month));
});

const quoteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  participants: z.object({ adult: z.number().int().min(0).max(50), child: z.number().int().min(0).max(50).default(0), infant: z.number().int().min(0).max(50).default(0) }),
  zone: z.string().optional(), guideLang: z.string().optional(), options: z.array(z.string()).default([]),
  promoCode: z.string().optional(), partnerCode: z.string().optional(), currency: z.enum(['EUR', 'GBP', 'TND']).default('EUR'),
});

/** Devis serveur (le même calcul que le navigateur, avec code promo et disponibilité) */
r.post('/excursions/:id/quote', async (req, res) => {
  const body = quoteSchema.parse(req.body);
  const { exc, price, discount } = await priceExcursionItem({ ...body, excursion: req.params.id }, { ...body, lang: lang(req) });
  const availability = body.date ? await checkAvailability(exc, body.date) : null;
  res.json({ price, discount: { rate: discount.rate, source: discount.source }, availability });
});

r.post('/waitlist', formLimiter, async (req, res) => {
  const w = z.object({ excursion: z.string(), date: z.string(), email: z.string().email(), name: z.string().optional(), phone: z.string().optional(), participants: z.number().optional(), lang: z.string().optional() }).parse(req.body);
  await Waitlist.create(w);
  res.status(201).json({ ok: true });
});

r.post('/promo/check', async (req, res) => {
  const d = await resolveDiscount({ promoCode: req.body.code, productId: req.body.excursion });
  res.json({ valid: d.source === 'promo', rate: d.source === 'promo' ? d.rate : 0 });
});

/* ---------- Transferts (§4) ---------- */
r.get('/transfers/locations', async (req, res) => {
  const l = lang(req);
  const q = String(req.query.q || '').trim();
  const filter = { active: true };
  if (q) {
    const re = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filter.$or = [{ name: re }, ...LANGS.map((x) => ({ [`label.${x}`]: re }))];
  }
  const list = await Location.find(filter).sort({ type: 1, name: 1 }).limit(20).lean();
  res.json(list.map((x) => ({ id: x._id, name: x.label?.[l] || x.name, type: x.type, zone: x.zone })));
});

r.get('/transfers/config', async (req, res) => {
  const l = lang(req);
  const cfg = await TransferConfig.findOne().lean();
  res.json({
    vehicles: (cfg?.vehicles || []).map((v) => ({ key: v.key, label: pick(v.label, l), maxPassengers: v.maxPassengers, maxLuggage: v.maxLuggage })),
    supplements: cfg?.supplements, returnDiscount: cfg?.returnDiscount, minNoticeHours: cfg?.minNoticeHours,
  });
});

const transferSchema = z.object({
  fromId: z.string().optional(), toId: z.string().optional(), fromZone: z.string().optional(), toZone: z.string().optional(),
  datetime: z.string(), flightNumber: z.string().optional(),
  passengers: z.object({ adult: z.number().int().min(1), child: z.number().int().min(0).default(0), infant: z.number().int().min(0).default(0) }),
  luggage: z.number().int().min(0).default(0), childSeats: z.number().int().min(0).default(0), nameSign: z.boolean().default(false), extraStops: z.number().int().min(0).default(0),
  roundTrip: z.boolean().default(false), returnDatetime: z.string().optional(),
  promoCode: z.string().optional(), currency: z.enum(['EUR', 'GBP', 'TND']).default('EUR'),
});

r.post('/transfers/quote', async (req, res) => {
  const body = transferSchema.parse(req.body);
  const l = lang(req);
  const out = await transferQuotes(body, body);
  out.quotes = out.quotes.map((q) => ({ ...q, label: pick(q.label, l) }));
  res.json(out);
});

r.get('/transfers/routes/:slug', async (req, res) => {
  const l = lang(req);
  const route = await TransferRoute.findOne({ [`slug.${l}`]: req.params.slug, published: true }).lean();
  if (!route) throw new HttpError(404, 'NOT_FOUND');
  res.json({ ...route, title: pick(route.title, l), description: pick(route.description, l), seo: route.seo?.[l] });
});

/* ---------- Réservation (§5.3) ---------- */
const itemSchema = z.object({
  type: z.enum(['excursion', 'transfer']),
  excursion: z.string().optional(), date: z.string().optional(), time: z.string().optional(),
  participants: z.object({ adult: z.number().int().min(1), child: z.number().int().min(0).default(0), infant: z.number().int().min(0).default(0) }),
  zone: z.string().optional(), guideLang: z.string().optional(), options: z.array(z.string()).default([]),
  transfer: transferSchema.omit({ passengers: true, promoCode: true, currency: true }).extend({ vehicle: z.string(), from: z.string().optional(), to: z.string().optional() }).optional(),
});
const bookingSchema = z.object({
  items: z.array(itemSchema).min(1).max(10),
  customer: z.object({ name: z.string().transform(cleanText).pipe(z.string().min(2).max(120)), email: z.string().trim().email(), phone: z.string().transform(cleanText).pipe(z.string().min(6).max(30)), hotel: z.string().max(120).transform(cleanText).optional(), room: z.string().max(20).transform(cleanText).optional(), notes: z.string().max(2000).optional() }),
  promoCode: z.string().optional(), partnerCode: z.string().optional(),
  currency: z.enum(['EUR', 'GBP', 'TND']).default('EUR'), lang: z.enum(['en', 'fr', 'de', 'it', 'es']).default('en'),
  consent: z.object({ terms: z.boolean(), cancellation: z.literal(true) }),
  captchaToken: z.string().optional(), website: z.string().optional(),
});

r.post('/bookings', formLimiter, antiSpam, async (req, res) => {
  const body = bookingSchema.parse(req.body);
  const booking = await createBooking({ ...body, ip: req.ip });
  notifyBookingCreated(booking).catch((e) => console.error(e));
  res.status(201).json({ ref: booking.ref, token: booking.token, status: booking.status, totalEur: booking.totalEur, totalDisplay: booking.totalDisplay, currency: booking.currency });
});

async function customerBooking(req) {
  const b = await Booking.findOne({ ref: req.params.ref });
  if (!b || b.token !== req.query.token) throw new HttpError(404, 'NOT_FOUND');
  return b;
}

/** Espace client sans mot de passe : lien secret reçu par e-mail (§5.5) */
r.get('/bookings/:ref', async (req, res) => {
  const b = await customerBooking(req);
  res.json({ ref: b.ref, status: b.status, items: b.items, customer: b.customer, totalEur: b.totalEur, totalDisplay: b.totalDisplay, currency: b.currency, canCancel: await canCustomerCancel(b), lang: b.lang });
});

r.patch('/bookings/:ref', async (req, res) => {
  const b = await customerBooking(req);
  const upd = z.object({ phone: z.string().optional(), hotel: z.string().optional(), room: z.string().optional(), notes: z.string().optional() }).parse(req.body);
  Object.assign(b.customer, upd);
  b.history.push({ by: 'client', action: 'updated' });
  await b.save();
  res.json({ ok: true });
});

r.post('/bookings/:ref/cancel', async (req, res) => {
  const b = await customerBooking(req);
  if (!(await canCustomerCancel(b))) throw new HttpError(400, 'CANCELLATION_CLOSED');
  b.status = 'cancelled';
  b.items.forEach((i) => { i.status = 'cancelled'; });
  b.history.push({ by: 'client', action: 'cancelled' });
  await b.save();
  notifyStatus(b, 'cancelled').catch(console.error);
  res.json({ ok: true });
});

r.get('/bookings/:ref/voucher.pdf', async (req, res) => {
  const b = await customerBooking(req);
  const s = await getSettings();
  const ids = b.items.map((i) => i.driver).filter(Boolean);
  const drivers = Object.fromEntries((await User.find({ _id: { $in: ids } }).lean()).map((d) => [String(d._id), d]));
  const pdf = await voucherPdf(b, { contact: s.contact, drivers });
  res.type('application/pdf').set('Content-Disposition', `inline; filename="${b.ref}.pdf"`).send(pdf);
});

/** Fichier .ics « ajouter au calendrier » */
r.get('/bookings/:ref/calendar.ics', async (req, res) => {
  const b = await customerBooking(req);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = b.items.filter((i) => i.status !== 'cancelled').map((i) => {
    const start = i.transfer?.datetime ? new Date(i.transfer.datetime) : new Date(`${i.date}T${i.time || '08:00'}:00`);
    const end = new Date(start.getTime() + 3 * 3600000);
    return `BEGIN:VEVENT\r\nUID:${b.ref}-${i._id}\r\nDTSTAMP:${fmt(new Date())}\r\nDTSTART:${fmt(start)}\r\nDTEND:${fmt(end)}\r\nSUMMARY:${i.title}\r\nDESCRIPTION:${b.ref}\r\nEND:VEVENT`;
  }).join('\r\n');
  res.type('text/calendar').send(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//tunisia-tours//FR\r\n${events}\r\nEND:VCALENDAR`);
});

/* ---------- Contact (§2) ---------- */
r.post('/contact', formLimiter, antiSpam, async (req, res) => {
  const m = z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().optional(), subject: z.string().min(2), message: z.string().min(5).max(5000), consent: z.literal(true), lang: z.string().optional() }).parse(req.body);
  await Message.create(m);
  sendMail({ to: config.teamEmail, subject: `Contact : ${m.subject}`, html: `<p>${m.name} &lt;${m.email}&gt; ${m.phone || ''}</p><p>${m.message.replace(/</g, '&lt;')}</p>` });
  res.status(201).json({ ok: true });
});

/* ---------- Blog ---------- */
r.get('/posts', async (req, res) => {
  const l = lang(req);
  const q = { published: true };
  if (req.query.category) q.category = req.query.category;
  const posts = await Post.find(q).sort({ publishedAt: -1 }).limit(+req.query.limit || 30).lean();
  res.json(posts.map((p) => ({ id: p._id, slug: pick(p.slug, l), title: pick(p.title, l), excerpt: pick(p.excerpt, l), image: p.image, imageAlt: pick(p.imageAlt, l), category: p.category, publishedAt: p.publishedAt })));
});
r.get('/posts/:slug', async (req, res) => {
  const l = lang(req);
  const p = await Post.findOne({ [`slug.${l}`]: req.params.slug, published: true }).lean();
  if (!p) throw new HttpError(404, 'NOT_FOUND');
  res.json({ ...p, slug: pick(p.slug, l), slugs: p.slug, title: pick(p.title, l), body: pick(p.body, l), excerpt: pick(p.excerpt, l), imageAlt: pick(p.imageAlt, l), seo: p.seo?.[l] || {} });
});

r.get('/redirect', async (req, res) => {
  const x = await Redirect.findOne({ from: req.query.path }).lean();
  res.json({ to: x?.to || null });
});

export default r;
