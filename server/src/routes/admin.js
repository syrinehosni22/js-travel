import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticator } from 'otplib';
import { computeExcursionPrice, groupTable, minimumWarnings } from '../lib/pricing.js';
import { User, Excursion, Booking, Location, Zone, TransferConfig, TransferRoute, Promo, Partner, Settings, Post, Message, AuditLog, Redirect, Customer, Waitlist, Review } from '../models/index.js';
import { refreshRating } from '../services/reviews.js';
import { auth, allow, audit, signToken } from '../middleware.js';
import { HttpError } from '../services/booking.js';
import { getSettings, clearSettingsCache, refreshRates } from '../services/settings.js';
import { driversFor } from '../services/drivers.js';
import { notifyStatus, sendDriverRoadmap, roadmapText, notifyAdminWhatsApp, bookingText, sendMail, sendWhatsApp, notificationStatus, teamEmail } from '../services/notify.js';
import { slugify, seoErrors, seoOverview, seoScore } from '../services/seo.js';
import { followsTitle, firstFreeSlug } from '../lib/slugs.js';
import { byDisplayOrder } from '../lib/order.js';
import { commissionRows, PAID_STATUSES } from '../lib/commission.js';
import { commissionWorkbook } from '../services/commission.js';
import { seoSummary } from '../services/seoSummary.js';
import { cleanText } from '../services/text.js';
import { LANGS, config } from '../config.js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { autoTranslate, translationProvider, translateTexts, SOURCE_LANG } from '../services/translate.js';

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|avif)$|^video\/(mp4|webm|quicktime|x-m4v)$/.test(file.mimetype)),
});

const r = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 });

/* ================= Authentification + double authentification ================= */
r.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase(), active: true });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'BAD_CREDENTIALS');
  if (user.twoFactorEnabled) return res.json({ twoFactor: true, token: signToken(user, { pre2fa: true }) });
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.post('/auth/2fa', loginLimiter, async (req, res) => {
  const { token, code } = z.object({ token: z.string(), code: z.string() }).parse(req.body);
  let p; try { p = jwt.verify(token, config.jwtSecret); } catch { throw new HttpError(401, 'INVALID_TOKEN'); }
  const user = await User.findById(p.sub);
  if (!user || !authenticator.check(code, user.twoFactorSecret)) throw new HttpError(401, 'BAD_CODE');
  res.json({ token: signToken(user), user: publicUser(user) });
});

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, twoFactorEnabled: u.twoFactorEnabled });

r.use(auth);

r.get('/me', (req, res) => res.json(publicUser(req.user)));

r.post('/me/2fa/setup', async (req, res) => {
  const secret = authenticator.generateSecret();
  await User.updateOne({ _id: req.user._id }, { twoFactorSecret: secret, twoFactorEnabled: false });
  res.json({ secret, otpauth: authenticator.keyuri(req.user.email, 'JS Travel Tunisia', secret) });
});
r.post('/me/2fa/enable', async (req, res) => {
  const u = await User.findById(req.user._id);
  if (!authenticator.check(String(req.body.code), u.twoFactorSecret)) throw new HttpError(400, 'BAD_CODE');
  u.twoFactorEnabled = true; await u.save();
  await audit(req, 'enable_2fa', 'user', u._id);
  res.json({ ok: true });
});

/* ================= Tableau de bord (§7.1) ================= */
r.get('/dashboard', allow('manager'), async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const [todayB, tomorrowB, toConfirm, unassigned, revenue] = await Promise.all([
    Booking.find({ 'items.date': today, status: { $ne: 'cancelled' } }).lean(),
    Booking.find({ 'items.date': tomorrow, status: { $ne: 'cancelled' } }).lean(),
    Booking.find({ status: 'new' }).sort({ createdAt: 1 }).lean(),
    Booking.find({ status: { $in: ['new', 'confirmed'] }, firstServiceDate: { $gte: today, $lte: tomorrow }, items: { $elemMatch: { driver: null, status: { $ne: 'cancelled' } } } }).lean(),
    Booking.aggregate([
      { $match: { status: { $in: ['confirmed', 'paid_on_site', 'completed'] }, firstServiceDate: { $gte: monthStart } } },
      { $group: { _id: null, expected: { $sum: '$totalEur' }, collected: { $sum: '$collectedAmount' }, count: { $sum: 1 } } },
    ]),
  ]);
  const oldNew = toConfirm.filter((b) => Date.now() - new Date(b.createdAt) > 6 * 3600000);
  res.json({
    today: todayB, tomorrow: tomorrowB, toConfirm,
    revenueMonth: revenue[0] || { expected: 0, collected: 0, count: 0 },
    alerts: [
      ...oldNew.map((b) => ({ type: 'unconfirmed', ref: b.ref, id: b._id })),
    ],
  });
});

/* ================= Réservations ================= */
r.get('/bookings', allow('manager', 'partner'), async (req, res) => {
  const q = {};
  if (req.user.role === 'partner') q.partner = req.user.partner;
  if (req.query.status) q.status = req.query.status;
  if (req.query.from || req.query.to) q.firstServiceDate = { ...(req.query.from && { $gte: req.query.from }), ...(req.query.to && { $lte: req.query.to }) };
  if (req.query.excursion) q['items.excursion'] = req.query.excursion;
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [{ ref: rx }, { 'customer.name': rx }, { 'customer.email': rx }, { 'customer.phone': rx }];
  }
  const page = Math.max(1, +req.query.page || 1);
  const [items, total] = await Promise.all([
    Booking.find(q).sort({ firstServiceDate: req.query.sort === 'created' ? undefined : 1, createdAt: -1 }).skip((page - 1) * 50).limit(50).populate('items.driver', 'name phone').lean(),
    Booking.countDocuments(q),
  ]);
  res.json({ items, total, page });
});

r.get('/bookings/export.csv', allow('manager'), async (req, res) => {
  const list = await Booking.find(req.query.status ? { status: req.query.status } : {}).sort({ firstServiceDate: 1 }).lean();
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Ref', 'Statut', 'Date', 'Client', 'E-mail', 'Téléphone', 'Hôtel', 'Prestations', 'Total EUR', 'Encaissé', 'Langue', 'Canal']];
  for (const b of list) rows.push([b.ref, b.status, b.firstServiceDate, b.customer.name, b.customer.email, b.customer.phone, b.customer.hotel, b.items.map((i) => i.title).join(' + '), b.totalEur, b.collectedAmount, b.lang, b.channel]);
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="reservations.csv"').send('﻿' + rows.map((r) => r.map(esc).join(';')).join('\n'));
});

r.get('/bookings/:id', allow('manager', 'partner', 'driver'), async (req, res) => {
  const b = await Booking.findById(req.params.id).populate('items.driver', 'name phone').populate('items.excursion', 'title').lean();
  if (!b) throw new HttpError(404, 'NOT_FOUND');
  if (req.user.role === 'partner' && String(b.partner) !== String(req.user.partner)) throw new HttpError(403, 'FORBIDDEN');
  res.json(b);
});

const STATUS = ['new', 'confirmed', 'paid_on_site', 'completed', 'cancelled', 'no_show'];
r.patch('/bookings/:id', allow('manager'), async (req, res) => {
  const body = z.object({
    status: z.enum(STATUS).optional(),
    collectedAmount: z.number().optional(), collectedCurrency: z.string().optional(),
    customer: z.object({ name: z.string(), email: z.string().email(), phone: z.string(), hotel: z.string().optional(), city: z.string().optional(), nationality: z.string().optional(), room: z.string().optional(), notes: z.string().optional() }).partial().optional(),
    items: z.array(z.object({ _id: z.string(), date: z.string().optional(), time: z.string().optional(), status: z.enum(['pending', 'confirmed', 'cancelled', 'waitlist']).optional(), driver: z.string().nullable().optional(), vehiclePlate: z.string().optional() })).optional(),
    note: z.string().optional(),
  }).parse(req.body);
  const b = await Booking.findById(req.params.id);
  if (!b) throw new HttpError(404, 'NOT_FOUND');
  const before = b.toObject();
  let driverChanged = false;
  if (body.customer) Object.assign(b.customer, body.customer);
  for (const it of body.items || []) {
    const sub = b.items.id(it._id);
    if (!sub) continue;
    if (it.driver !== undefined && String(sub.driver || '') !== String(it.driver || '')) driverChanged = true;
    Object.assign(sub, it);
  }
  if (body.collectedAmount != null) { b.collectedAmount = body.collectedAmount; b.collectedCurrency = body.collectedCurrency || 'EUR'; }
  const prevStatus = b.status;
  if (body.status) {
    b.status = body.status;
    if (body.status === 'confirmed') b.items.forEach((i) => { if (i.status === 'pending') i.status = 'confirmed'; });
    if (body.status === 'cancelled') b.items.forEach((i) => { i.status = 'cancelled'; });
    if (body.status === 'no_show') {
      const c = await Customer.findOneAndUpdate({ email: b.customer.email }, { $inc: { noShowCount: 1 } }, { new: true, upsert: true });
      const s = await getSettings();
      if (c.noShowCount >= (s.noShowBlockAfter || 2)) { c.blocked = true; await c.save(); }
    }
  }
  b.history.push({ by: req.user.name || req.user.email, action: body.status ? `status:${body.status}` : 'updated', note: body.note });
  await b.save();
  await audit(req, 'update', 'booking', b._id, { status: before.status }, { status: b.status });
  if (body.status && body.status !== prevStatus && ['confirmed', 'cancelled'].includes(body.status)) notifyStatus(b, body.status).catch(console.error);
  // Le chauffeur est une information interne : le client n'est pas prévenu d'un changement de chauffeur
  res.json(b);
});

/** Actions groupées : confirmer plusieurs réservations */
r.delete('/bookings/:id', allow('manager'), async (req, res) => {
  const b = await Booking.findById(req.params.id).lean();
  if (!b) throw new HttpError(404, 'NOT_FOUND');
  await Booking.deleteOne({ _id: b._id });
  await audit(req, 'delete', 'booking', b._id, { ref: b.ref, customer: b.customer?.name, totalEur: b.totalEur });
  res.json({ ok: true });
});

r.post('/bookings/bulk', allow('manager'), async (req, res) => {
  const { ids, status } = z.object({ ids: z.array(z.string()).min(1), status: z.enum(STATUS) }).parse(req.body);
  const list = await Booking.find({ _id: { $in: ids } });
  for (const b of list) {
    b.status = status;
    if (status === 'confirmed') b.items.forEach((i) => { if (i.status === 'pending') i.status = 'confirmed'; });
    b.history.push({ by: req.user.name, action: `status:${status}` });
    await b.save();
    if (['confirmed', 'cancelled'].includes(status)) notifyStatus(b, status).catch(console.error);
  }
  await audit(req, 'bulk_status', 'booking', ids.join(','), null, { status });
  res.json({ updated: list.length });
});

r.post('/bookings/:id/resend', allow('manager'), async (req, res) => {
  const b = await Booking.findById(req.params.id);
  if (!b) throw new HttpError(404, 'NOT_FOUND');
  const r = await notifyStatus(b, 'confirmed');
  res.json({ ok: true, ...r });
});

/** Réservation saisie par l'équipe (téléphone, WhatsApp) */
r.post('/bookings', allow('manager'), async (req, res) => {
  const { createBooking } = await import('../services/booking.js');
  const b = await createBooking({ ...req.body, consent: { terms: true, cancellation: true }, ip: req.ip });
  b.channel = req.body.channel || 'phone';
  b.history.push({ by: req.user.name, action: 'created_by_team' });
  await b.save();
  res.status(201).json(b);
});

/* ================= Planning (§7.1) ================= */
r.get('/planning', allow('manager', 'driver'), async (req, res) => {
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const to = req.query.to || from;
  const match = { status: { $nin: ['cancelled'] } };
  const list = await Booking.aggregate([
    { $match: match }, { $unwind: '$items' },
    { $match: { 'items.date': { $gte: from, $lte: to }, 'items.status': { $ne: 'cancelled' }, ...(req.user.role === 'driver' && { 'items.driver': req.user._id }) } },
    { $project: { ref: 1, status: 1, customer: 1, item: '$items' } },
    { $sort: { 'item.date': 1, 'item.time': 1 } },
  ]);
  const drivers = req.user.role === 'driver' ? [] : await User.find({ role: 'driver', active: true }).select('name phone vehicle unavailableDates').lean();
  res.json({ items: list, drivers });
});

/*
 * Feuilles de route : pour la date choisie, chaque chauffeur qui a au moins une prestation reçoit
 * par WhatsApp la liste de ses prestations (heure, excursion ou trajet, client, hôtel, téléphone).
 * La réponse donne aussi le texte et le numéro, pour l'envoyer à la main si l'envoi automatique échoue.
 */
r.post('/planning/roadmaps', allow('manager'), async (req, res) => {
  const date = req.body.date || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const drivers = await User.find({ role: 'driver', active: true }).lean();
  const results = [];
  for (const d of drivers) {
    const items = await Booking.aggregate([{ $match: { status: { $nin: ['cancelled', 'no_show'] } } }, { $unwind: '$items' }, { $match: { 'items.date': date, 'items.driver': d._id, 'items.status': { $ne: 'cancelled' } } },
      { $project: { title: '$items.title', time: '$items.time', transfer: '$items.transfer', customer: '$customer.name', phone: '$customer.phone', hotel: '$customer.hotel',
        pax: { $add: [{ $ifNull: ['$items.participants.adult', 0] }, { $ifNull: ['$items.participants.child', 0] }, { $ifNull: ['$items.participants.infant', 0] }] } } }, { $sort: { time: 1 } }]);
    if (!items.length) continue;
    const r = d.phone ? await sendDriverRoadmap(d, items, date) : { ok: false, error: 'Pas de numéro de téléphone' };
    results.push({ driver: d.name, phone: d.phone || '', count: items.length, text: roadmapText(d, date, items), ...r });
  }
  res.json({ date, sent: results.filter((x) => x.ok).length, results });
});

/* ================= Chauffeurs ================= */
const driverPublic = (u) => ({ _id: u._id, name: u.name, phone: u.phone, vehicle: u.vehicle || {}, languages: u.languages || [], notes: u.notes || '', active: u.active !== false,
  email: /@chauffeurs\.invalid$/.test(u.email || '') ? '' : u.email, canLogin: !/@chauffeurs\.invalid$/.test(u.email || '') });
const driverBody = z.object({
  name: z.string().trim().min(2), phone: z.string().trim().min(6),
  vehicle: z.object({ label: z.string().optional(), plate: z.string().optional(), capacity: z.coerce.number().int().min(0).optional() }).partial().optional(),
  languages: z.array(z.string()).optional(), notes: z.string().optional(), active: z.boolean().optional(),
  email: z.string().trim().email().optional().or(z.literal('')), password: z.string().min(10).optional().or(z.literal('')),
});
r.get('/drivers', allow('manager'), async (_req, res) => res.json((await User.find({ role: 'driver' }).sort({ active: -1, name: 1 }).lean()).map(driverPublic)));
r.post('/drivers', allow('manager'), async (req, res) => {
  const b = driverBody.parse(req.body);
  if (b.email && !b.password) throw new HttpError(400, 'PASSWORD_REQUIRED', 'Pour qu’il puisse se connecter à son planning, donnez un mot de passe (10 caractères minimum).');
  // Sans e-mail : fiche chauffeur sans accès à l'admin (adresse technique, mot de passe aléatoire)
  const email = b.email || `chauffeur-${crypto.randomBytes(6).toString('hex')}@chauffeurs.invalid`;
  const password = b.password || crypto.randomBytes(24).toString('hex');
  const u = await User.create({ name: b.name, phone: b.phone, vehicle: b.vehicle, languages: b.languages, notes: b.notes, role: 'driver', email, passwordHash: await bcrypt.hash(password, 12) });
  await audit(req, 'create', 'driver', u._id);
  res.status(201).json(driverPublic(u.toObject()));
});
r.put('/drivers/:id', allow('manager'), async (req, res) => {
  const b = driverBody.partial().parse(req.body);
  const u = await User.findOne({ _id: req.params.id, role: 'driver' });
  if (!u) throw new HttpError(404, 'NOT_FOUND');
  for (const k of ['name', 'phone', 'vehicle', 'languages', 'notes', 'active']) if (b[k] !== undefined) u[k] = b[k];
  if (b.email) u.email = b.email;
  if (b.password) u.passwordHash = await bcrypt.hash(b.password, 12);
  await u.save();
  await audit(req, 'update', 'driver', u._id);
  res.json(driverPublic(u.toObject()));
});
r.delete('/drivers/:id', allow('manager'), async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, role: 'driver' }).lean();
  if (!u) throw new HttpError(404, 'NOT_FOUND');
  // Chauffeur déjà affecté à des réservations : on le désactive pour garder l'historique
  if (await Booking.exists({ 'items.driver': u._id })) {
    await User.updateOne({ _id: u._id }, { active: false });
    await audit(req, 'deactivate', 'driver', u._id);
    return res.json({ ok: true, deactivated: true });
  }
  await User.deleteOne({ _id: u._id });
  await audit(req, 'delete', 'driver', u._id);
  res.json({ ok: true });
});

/* ================= Excursions (§7.1, §8.2) ================= */
r.get('/excursions', allow('manager', 'editor'), async (_req, res) => {
  const list = (await Excursion.find().lean()).sort(byDisplayOrder);
  res.json(list.map((e) => ({
    _id: e._id, position: e.position, title: e.title, slug: e.slug, category: e.category, published: e.published, publishedLangs: e.publishedLangs,
    translation: e.translation, image: e.images?.[0]?.url, pricingMode: e.pricing?.mode,
    seo: Object.fromEntries(LANGS.map((l) => [l, { score: seoScore(e, l).score, missing: seoErrors(e, l).length }])),
    warnings: minimumWarnings(e),
  })));
});

r.get('/excursions/:id', allow('manager', 'editor'), async (req, res) => {
  const e = await Excursion.findById(req.params.id).lean();
  if (!e) throw new HttpError(404, 'NOT_FOUND');
  res.json({ ...e, seoReport: seoOverview(e), groupTables: { low: groupTable(e, 'low'), mid: groupTable(e, 'mid'), high: groupTable(e, 'high') }, warnings: minimumWarnings(e) });
});

/** Vérifie qu'un mot-clé principal n'est pas déjà utilisé par une autre fiche (§8.2) */
async function keywordConflicts(e) {
  const out = [];
  for (const l of LANGS) {
    const kw = e.seo?.[l]?.focusKeyword;
    if (!kw) continue;
    const other = await Excursion.findOne({ _id: { $ne: e._id }, [`seo.${l}.focusKeyword`]: kw }).select('title').lean();
    if (other) out.push({ lang: l, keyword: kw, usedBy: other._id });
  }
  return out;
}

async function nextPosition() {
  const last = await Excursion.findOne({ position: { $ne: null } }).sort({ position: -1 }).select('position').lean();
  return (last?.position || 0) + 1;
}

async function saveExcursion(req, e, data) {
  const isNew = e.isNew;
  if (isNew && data.position == null) data.position = await nextPosition();
  const before = isNew ? null : e.toObject();

  // Traduction automatique depuis le français : champs vides remplis, texte modifié retraduit (sauf langues « Relu »)
  const force = !!data._retranslate; delete data._retranslate;
  const status = { ...(before?.translation || {}), ...(data.translation || {}) };
  const reviewed = force ? {} : Object.fromEntries(LANGS.map((l) => [l, status[l] === 'reviewed']));
  const translation = await autoTranslate(data, before, { reviewed, force, seo: true });
  for (const l of Object.keys(translation.languages)) if (!status[l] || status[l] === 'missing' || force) status[l] = 'auto';
  status[SOURCE_LANG()] = status[SOURCE_LANG()] === 'missing' || !status[SOURCE_LANG()] ? 'reviewed' : status[SOURCE_LANG()];
  data.translation = status;
  // Slugs : générés depuis le titre si vides, historisés + redirection 301 s'ils changent
  for (const l of LANGS) {
    const title = data.title?.[l];
    if (data.slug && data.slug[l] !== undefined) data.slug[l] = slugify(data.slug[l]);
    const current = data.slug?.[l] || e.slug?.[l];
    // L'adresse suit le titre tant qu'elle n'a pas été personnalisée (ex. « nouvelle-excursion » après renommage)
    const oldTitle = before?.title?.[l];
    if (title && (!current || (oldTitle && title !== oldTitle && followsTitle(current, oldTitle)))) { data.slug = data.slug || {}; data.slug[l] = slugify(title); }
    // Jamais deux excursions avec la même adresse : -2, -3… si elle est déjà prise
    if (data.slug?.[l]) data.slug[l] = await firstFreeSlug(data.slug[l], (s) => Excursion.exists({ _id: { $ne: e._id }, [`slug.${l}`]: s }));
    const oldSlug = e.slug?.[l];
    const newSlug = data.slug?.[l];
    if (oldSlug && newSlug && oldSlug !== newSlug) {
      e.slugHistory.push({ lang: l, slug: oldSlug });
      await Redirect.updateOne({ from: `/${l}/excursions/${oldSlug}` }, { to: `/${l}/excursions/${newSlug}` }, { upsert: true });
    }
  }
  e.set(data);
  // Langues traduites automatiquement : publiées avec la langue source si leur SEO est complet
  const src = SOURCE_LANG();
  if ((e.publishedLangs || []).includes(src)) {
    for (const l of Object.keys(translation.languages)) {
      if (!e.publishedLangs.includes(l) && seoErrors(e, l).length === 0) e.publishedLangs.push(l);
    }
  }
  // Publication bloquée tant que les champs SEO obligatoires manquent dans la langue publiée
  if (e.published) {
    const langs = (e.publishedLangs?.length ? e.publishedLangs : ['en']);
    const missing = Object.fromEntries(langs.map((l) => [l, seoErrors(e, l)]).filter(([, v]) => v.length));
    if (Object.keys(missing).length) throw new HttpError(400, 'SEO_INCOMPLETE', 'Champs SEO obligatoires manquants', missing);
  }
  const conflicts = await keywordConflicts(e);
  await e.save();
  const pricingChanged = before && JSON.stringify(before.pricing) !== JSON.stringify(e.toObject().pricing);
  await audit(req, isNew ? 'create' : 'update', 'excursion', e._id);
  if (pricingChanged) await audit(req, 'price_change', 'pricing', e._id, before.pricing, e.toObject().pricing);
  return { excursion: e, conflicts, warnings: minimumWarnings(e), seoReport: seoOverview(e), translation };
}

r.post('/excursions', allow('editor', 'manager'), async (req, res) => res.status(201).json(await saveExcursion(req, new Excursion(), req.body)));

/** Ordre d'affichage sur le site : liste complète des identifiants, dans l'ordre voulu */
r.put('/excursions/order', allow('editor', 'manager'), async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(500) }).parse(req.body);
  await Excursion.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { position: i + 1 } } } })));
  await audit(req, 'reorder', 'excursion', null);
  res.json({ ok: true });
});

r.put('/excursions/:id', allow('editor', 'manager'), async (req, res) => {
  const e = await Excursion.findById(req.params.id);
  if (!e) throw new HttpError(404, 'NOT_FOUND');
  const data = { ...req.body }; delete data._id; delete data.createdAt; delete data.updatedAt; delete data.seoReport; delete data.groupTables; delete data.warnings;
  res.json(await saveExcursion(req, e, data));
});

r.post('/excursions/:id/duplicate', allow('editor', 'manager'), async (req, res) => {
  const src = await Excursion.findById(req.params.id).lean();
  if (!src) throw new HttpError(404, 'NOT_FOUND');
  delete src._id;
  // Adresse de la copie : « …-copie », puis « …-copie-2 »… si elle existe déjà
  const slug = {};
  for (const l of LANGS) slug[l] = src.slug?.[l] ? await firstFreeSlug(`${src.slug[l]}-copie`, (x) => Excursion.exists({ [`slug.${l}`]: x })) : '';
  const copy = new Excursion({ ...src, position: await nextPosition(), published: false, publishedLangs: [], slugHistory: [], slug, title: Object.fromEntries(LANGS.map((l) => [l, src.title?.[l] ? src.title[l] + ' (copie)' : ''])) });
  await copy.save();
  await audit(req, 'duplicate', 'excursion', copy._id);
  res.status(201).json(copy);
});

/** Réservations à venir liées à une excursion (affichées avant la suppression) */
r.get('/excursions/:id/usage', allow('manager', 'editor'), async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const futureBookings = await Booking.countDocuments({ 'items.excursion': req.params.id, status: { $nin: ['cancelled', 'completed', 'no_show'] }, firstServiceDate: { $gte: today } });
  res.json({ futureBookings });
});

r.delete('/excursions/:id', allow('manager'), async (req, res) => {
  const e = await Excursion.findById(req.params.id).lean();
  if (!e) throw new HttpError(404, 'NOT_FOUND');
  await Excursion.deleteOne({ _id: req.params.id });
  // Les anciennes URL renvoient vers le catalogue plutôt qu'une page introuvable
  for (const l of LANGS) if (e.slug?.[l]) await Redirect.updateOne({ from: `/${l}/excursions/${e.slug[l]}` }, { to: `/${l}/excursions` }, { upsert: true });
  await audit(req, 'delete', 'excursion', req.params.id);
  res.json({ ok: true });
});

/** Simulateur de prix (§3.6) : tester une combinaison avant publication */
r.post('/pricing/simulate', allow('manager', 'editor'), async (req, res) => {
  const s = await getSettings();
  const { excursion, booking, discountPercent = 0 } = req.body;
  res.json({
    price: computeExcursionPrice(excursion, booking, { calendar: s.calendar, cityTransfers: s.cityTransfers, discount: { rate: discountPercent / 100, source: 'simulation' } }),
    warnings: minimumWarnings(excursion),
    groupTable: groupTable(excursion, booking.season || 'mid'),
  });
});

r.get('/pricing/history/:id', allow('manager'), async (req, res) => {
  res.json(await AuditLog.find({ entity: 'pricing', entityId: req.params.id }).sort({ createdAt: -1 }).limit(50).lean());
});

/** Traduction ponctuelle (DeepL si clé, sinon MyMemory) */
r.post('/translate', allow('editor', 'manager'), async (req, res) => {
  const { texts, source = 'fr', target } = z.object({ texts: z.array(z.string()).max(200), source: z.string().optional(), target: z.enum(['en', 'fr', 'de', 'it', 'es']) }).parse(req.body);
  try { res.json({ texts: await translateTexts(texts, source, target) }); }
  catch (e) { throw new HttpError(502, 'TRANSLATION_FAILED', e.message); }
});
r.get('/translate/status', allow('editor', 'manager'), (_req, res) => res.json({ provider: translationProvider(), source: SOURCE_LANG() }));

/** Photos et vidéos par glisser-déposer (stockage disque ; remplaçable par S3/Cloudinary) */
r.post('/uploads', allow('editor', 'manager'), upload.array('files', 20), (req, res) => {
  res.status(201).json((req.files || []).map((f) => ({ url: `/uploads/${f.filename}`, name: f.originalname, size: f.size })));
});

/* ================= Transferts ================= */
r.get('/transfers', allow('manager'), async (_req, res) => {
  const [config_, zones, locations, routes] = await Promise.all([TransferConfig.findOne().lean(), Zone.find().lean(), Location.find().sort({ zone: 1, name: 1 }).lean(), TransferRoute.find().lean()]);
  res.json({ config: config_, zones, locations, routes });
});
r.put('/transfers/config', allow('manager'), async (req, res) => {
  const before = await TransferConfig.findOne().lean();
  const { _id, createdAt, updatedAt, __v, ...data } = req.body;
  const translation = await autoTranslate(data, before);
  const after = await TransferConfig.findOneAndUpdate({}, data, { upsert: true, new: true, runValidators: true });
  await audit(req, 'update', 'transfer_pricing', after._id, before, after.toObject());
  res.json({ ...after.toObject(), translation });
});
/** Avant enregistrement : complète les traductions (et les URL traduites vides) */
async function prepareTranslated(Model, data, before) {
  if (Model === Location) {
    // Un hôtel garde son nom dans toutes les langues ; aéroports et villes sont traduits
    data.label = { ...(before?.label || {}), ...(data.label || {}) };
    if (!data.label[SOURCE_LANG()]) data.label[SOURCE_LANG()] = data.name || before?.name || '';
    if ((data.type || before?.type) === 'hotel') { for (const l of LANGS) data.label[l] = data.label[SOURCE_LANG()]; return { languages: {} }; }
  }
  if (Model === Zone && data.label && !data.key) data.key = slugify(data.label[SOURCE_LANG()] || data.label.en || '');
  const translation = await autoTranslate(data, before);
  if (data.slug && data.title) for (const l of LANGS) if (!data.slug[l] && data.title[l]) data.slug[l] = slugify(data.title[l]);
  return translation;
}
const TRANSLATED = new Set([Zone, Location, TransferRoute, Post]);

const crud = (Model, entity, roles = ['manager']) => {
  const path = `/${entity}`;
  r.get(path, allow(...roles), async (_req, res) => res.json(await Model.find().sort({ createdAt: -1 }).lean()));
  r.post(path, allow(...roles), async (req, res) => {
    const data = { ...req.body };
    const translation = TRANSLATED.has(Model) ? await prepareTranslated(Model, data, null) : undefined;
    const d = await Model.create(data); await audit(req, 'create', entity, d._id);
    res.status(201).json({ ...d.toObject(), translation });
  });
  r.put(`${path}/:id`, allow(...roles), async (req, res) => {
    const { _id, createdAt, updatedAt, __v, ...data } = req.body;
    const before = await Model.findById(req.params.id).lean();
    if (!before) throw new HttpError(404, 'NOT_FOUND');
    const translation = TRANSLATED.has(Model) ? await prepareTranslated(Model, data, before) : undefined;
    const d = await Model.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    await audit(req, 'update', entity, d._id); res.json({ ...d.toObject(), translation });
  });
  r.delete(`${path}/:id`, allow(...roles), async (req, res) => {
    if (Model === Zone) {
      const z = await Zone.findById(req.params.id).lean();
      if (!z) throw new HttpError(404, 'NOT_FOUND');
      const [places, cfg] = await Promise.all([Location.countDocuments({ zone: z.key }), TransferConfig.findOne().lean()]);
      const prices = (cfg?.grid || []).filter((g) => g.fromZone === z.key || g.toZone === z.key).length;
      if (places || prices) throw new HttpError(409, 'ZONE_IN_USE', `Cette zone est encore utilisée (${places} lieu(x), ${prices} prix). Supprimez ou déplacez-les d’abord.`);
    }
    const d = await Model.findByIdAndDelete(req.params.id);
    if (!d) throw new HttpError(404, 'NOT_FOUND');
    await audit(req, 'delete', entity, req.params.id); res.json({ ok: true });
  });
};
crud(Zone, 'zones');
crud(Location, 'locations');
crud(TransferRoute, 'transfer-routes', ['manager', 'editor']);
crud(Promo, 'promos');
crud(Partner, 'partners');
crud(Post, 'posts', ['editor', 'manager']);
crud(Message, 'messages');

/* Test de l'alerte WhatsApp équipe (Admin → Paramètres) */
r.get('/notifications/status', allow(), async (_req, res) => res.json({ ...notificationStatus(), teamEmail: await teamEmail() }));
r.post('/notifications/test-email', allow(), async (req, res) => {
  const to = String(req.body?.to || req.user?.email || '').trim();
  res.json({ to, ...(await sendMail({ to, subject: 'JS Travel : test des e-mails', html: '<p>Les e-mails du site fonctionnent : les clients recevront leurs confirmations et vouchers.</p>' })) });
});
r.post('/notifications/test-client', allow(), async (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  const lang = ['fr', 'en', 'de', 'it', 'es'].includes(req.body?.lang) ? req.body.lang : 'fr';
  res.json({ phone, ...(await sendWhatsApp(phone, 'Test des messages WhatsApp aux clients de JS Travel', { lang })) });
});
r.post('/notifications/test', allow(), async (_req, res) => {
  const results = await notifyAdminWhatsApp('JS Travel : test des alertes WhatsApp. Vous recevrez un message comme celui-ci à chaque nouvelle réservation.');
  res.json({ results });
});

/* Texte prêt à envoyer par WhatsApp pour une réservation */
r.get('/bookings/:id/whatsapp-text', allow('manager', 'partner'), async (req, res) => {
  const b = await Booking.findById(req.params.id).lean();
  if (!b) throw new HttpError(404, 'NOT_FOUND');
  res.json({ text: bookingText(b, await driversFor(b)).replace(/^Nouvelle réservation/, 'Réservation') });
});

/* ================= Avis clients : modération ================= */
r.get('/reviews', allow('manager', 'editor'), async (req, res) => {
  const q = ['pending', 'approved', 'rejected'].includes(req.query.status) ? { status: req.query.status } : {};
  if (req.query.scope === 'site') q.scope = 'site';
  else if (req.query.scope === 'excursion') q.scope = { $ne: 'site' };
  const list = await Review.find(q).sort({ createdAt: -1 }).limit(500).populate('excursion', 'title slug').lean();
  const counts = Object.fromEntries((await Review.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])).map((x) => [x._id, x.n]));
  res.json({ list, counts });
});
r.put('/reviews/:id', allow('manager', 'editor'), async (req, res) => {
  const d = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional(), reply: z.string().max(2000).optional() }).parse(req.body);
  const rv = await Review.findByIdAndUpdate(req.params.id, d, { new: true });
  if (!rv) throw new HttpError(404, 'NOT_FOUND');
  if (rv.excursion) await refreshRating(rv.excursion);
  await audit(req, 'update', 'reviews', rv._id);
  res.json(rv);
});
r.delete('/reviews/:id', allow('manager'), async (req, res) => {
  const rv = await Review.findByIdAndDelete(req.params.id);
  if (rv) { if (rv.excursion) await refreshRating(rv.excursion); await audit(req, 'delete', 'reviews', rv._id); }
  res.json({ ok: true });
});
crud(Waitlist, 'waitlist');

/* ================= Clients (RGPD) ================= */
r.get('/customers', allow('manager'), async (req, res) => {
  const rx = req.query.q ? new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
  const list = await Booking.aggregate([
    ...(rx ? [{ $match: { $or: [{ 'customer.name': rx }, { 'customer.email': rx }] } }] : []),
    { $group: { _id: '$customer.email', name: { $last: '$customer.name' }, phone: { $last: '$customer.phone' }, bookings: { $sum: 1 }, total: { $sum: '$totalEur' }, last: { $max: '$firstServiceDate' } } },
    { $sort: { last: -1 } }, { $limit: 200 },
  ]);
  const flags = Object.fromEntries((await Customer.find({ email: { $in: list.map((x) => x._id) } }).lean()).map((c) => [c.email, c]));
  res.json(list.map((x) => ({ ...x, email: x._id, noShowCount: flags[x._id]?.noShowCount || 0, blocked: !!flags[x._id]?.blocked })));
});
r.patch('/customers/:email', allow('manager'), async (req, res) => {
  const email = req.params.email.toLowerCase();
  const b = z.object({ blocked: z.boolean().optional(), name: z.string().min(1).optional(), phone: z.string().optional() }).parse(req.body);
  const c = await Customer.findOneAndUpdate({ email }, b, { upsert: true, new: true });
  // Le nom et le téléphone sont aussi corrigés sur ses réservations
  const fix = {}; if (b.name) fix['customer.name'] = b.name; if (b.phone !== undefined) fix['customer.phone'] = b.phone;
  if (Object.keys(fix).length) await Booking.updateMany({ 'customer.email': email }, { $set: fix });
  await audit(req, 'update', 'customer', email, null, b);
  res.json(c);
});
/** Droit à l'effacement : anonymise les réservations et supprime le compte */
r.delete('/customers/:email', allow(), async (req, res) => {
  const email = req.params.email.toLowerCase();
  await Booking.updateMany({ 'customer.email': email }, { $set: { 'customer.name': 'Anonyme', 'customer.email': `anon-${Date.now()}@deleted.invalid`, 'customer.phone': '', 'customer.hotel': '', 'customer.room': '', 'customer.notes': '' } });
  await Customer.deleteOne({ email });
  await Message.deleteMany({ email });
  await audit(req, 'gdpr_delete', 'customer', email);
  res.json({ ok: true });
});

/* ================= Équipe ================= */
r.get('/users', allow(), async (_req, res) => res.json((await User.find().lean()).map(({ passwordHash, twoFactorSecret, ...u }) => u)));
r.post('/users', allow(), async (req, res) => {
  const b = z.object({ name: z.string(), email: z.string().email(), password: z.string().min(10), role: z.enum(['admin', 'manager', 'editor', 'driver', 'partner']), phone: z.string().optional(), partner: z.string().optional() }).parse(req.body);
  const u = await User.create({ ...b, passwordHash: await bcrypt.hash(b.password, 12) });
  await audit(req, 'create', 'user', u._id);
  res.status(201).json(publicUser(u));
});
r.put('/users/:id', allow(), async (req, res) => {
  const { password, ...rest } = req.body;
  if (password) rest.passwordHash = await bcrypt.hash(password, 12);
  const u = await User.findByIdAndUpdate(req.params.id, rest, { new: true });
  await audit(req, 'update', 'user', req.params.id);
  res.json(publicUser(u));
});

r.delete('/users/:id', allow(), async (req, res) => {
  if (String(req.user._id) === req.params.id) throw new HttpError(400, 'SELF_DELETE', 'Vous ne pouvez pas supprimer votre propre compte.');
  const u = await User.findById(req.params.id).lean();
  if (!u) throw new HttpError(404, 'NOT_FOUND');
  if (u.role === 'admin' && (await User.countDocuments({ role: 'admin', active: true })) <= 1) throw new HttpError(400, 'LAST_ADMIN', 'Impossible de supprimer le dernier administrateur.');
  await User.deleteOne({ _id: u._id });
  await audit(req, 'delete', 'user', u._id, { email: u.email });
  res.json({ ok: true });
});

/* ================= Paramètres ================= */
r.get('/settings', allow('manager', 'editor'), async (_req, res) => res.json(await getSettings()));
r.put('/settings', allow(), async (req, res) => {
  const { _id, createdAt, updatedAt, ...data } = req.body;
  // Numéros et adresses copiés-collés : on retire les caractères invisibles
  if (data.contact) data.contact = Object.fromEntries(Object.entries(data.contact).map(([k, v]) => [k, typeof v === 'string' ? cleanText(v) : v]));
  const prev = await Settings.findOne().lean();
  const translation = await autoTranslate(data, prev);
  const s = await Settings.findOneAndUpdate({}, data, { new: true, upsert: true });
  clearSettingsCache();
  await audit(req, 'update', 'settings', s._id);
  if (data.fx?.mode === 'auto') refreshRates();
  res.json({ ...s.toObject(), translation });
});

/* ================= Page d'accueil (bannières, incontournables) ================= */
r.get('/home-content', allow('editor', 'manager'), async (_req, res) => res.json((await getSettings()).home || {}));
r.put('/home-content', allow('editor', 'manager'), async (req, res) => {
  const home = req.body || {};
  const prev = (await Settings.findOne().lean())?.home || null;
  const translation = await autoTranslate(home, prev);
  const s = await Settings.findOneAndUpdate({}, { $set: { home } }, { new: true, upsert: true });
  clearSettingsCache();
  await audit(req, 'update', 'home_content', s._id);
  res.json({ ...(s.toObject().home || {}), translation });
});

/* ================= Rapports (§7.1) ================= */
r.get('/reports/sales', allow('manager'), async (req, res) => {
  const from = req.query.from || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const to = req.query.to || '9999-12-31';
  const by = { product: '$items.title', month: { $substr: ['$items.date', 0, 7] }, lang: '$lang', channel: '$channel' }[req.query.by || 'product'] || '$items.title';
  const rows = await Booking.aggregate([
    { $match: { status: { $in: ['confirmed', 'paid_on_site', 'completed'] } } }, { $unwind: '$items' },
    { $match: { 'items.date': { $gte: from, $lte: to }, 'items.status': { $ne: 'cancelled' } } },
    { $group: { _id: by, bookings: { $sum: 1 }, revenue: { $sum: '$items.totalEur' }, people: { $sum: { $add: [{ $ifNull: ['$items.participants.adult', 0] }, { $ifNull: ['$items.participants.child', 0] }] } } } },
    { $sort: { revenue: -1 } },
  ]);
  if (req.query.format === 'csv') {
    return res.type('text/csv').set('Content-Disposition', 'attachment; filename="ventes.csv"')
      .send('﻿Groupe;Réservations;Personnes;CA EUR\n' + rows.map((x) => `"${x._id}";${x.bookings};${x.people};${x.revenue}`).join('\n'));
  }
  res.json(rows);
});

/** Commissions partenaires */
/* Commission (Syrine par défaut) sur les réservations abouties : tableau + Excel */
r.get('/reports/commission', allow('manager'), async (req, res) => {
  const s = await getSettings();
  const now = new Date();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to) ? req.query.to : now.toISOString().slice(0, 10);
  const percent = req.query.percent !== undefined && req.query.percent !== '' ? Math.max(0, Math.min(100, +req.query.percent || 0)) : (s.commission?.percent ?? 10);
  const name = s.commission?.name || 'Syrine';
  const bookings = await Booking.find({ status: { $in: PAID_STATUSES }, firstServiceDate: { $gte: from, $lte: to } }).select('ref status firstServiceDate customer.name items.title items.status totalEur collectedAmount').lean();
  const result = { name, from, to, ...commissionRows(bookings, percent) };
  if (req.query.format === 'xlsx') {
    const buf = await commissionWorkbook(result);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="commission-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${from}-${to}.xlsx"`);
    return res.send(Buffer.from(buf));
  }
  res.json(result);
});

r.get('/reports/partners', allow('manager', 'partner'), async (req, res) => {
  const match = { status: { $in: ['paid_on_site', 'completed'] }, partner: { $ne: null } };
  if (req.user.role === 'partner') match.partner = req.user.partner;
  const rows = await Booking.aggregate([{ $match: match }, { $group: { _id: '$partner', revenue: { $sum: '$totalEur' }, bookings: { $sum: 1 } } },
    { $lookup: { from: 'partners', localField: '_id', foreignField: '_id', as: 'p' } }, { $unwind: '$p' },
    { $project: { name: '$p.name', revenue: 1, bookings: 1, commission: { $multiply: ['$revenue', { $divide: ['$p.commissionPercent', 100] }] } } }]);
  res.json(rows);
});

/** Tableau SEO : score, champs manquants par fiche et langue (§8.2) */
r.get('/seo', allow('editor', 'manager'), async (_req, res) => {
  const list = await Excursion.find().lean();
  res.json(list.map((e) => ({ id: e._id, title: e.title?.fr || e.title?.en, report: seoOverview(e) })));
});

/** Bilan SEO global du site (tableau de bord) */
r.get('/seo/summary', allow('editor', 'manager'), async (_req, res) => {
  const [excursions, posts, routes, settings] = await Promise.all([
    Excursion.find().select('title slug summary description images seo published publishedLangs related').lean(),
    Post.find().select('slug published').lean(),
    TransferRoute.find().select('slug published').lean(),
    getSettings(),
  ]);
  res.json(seoSummary({ excursions, posts, routes, settings, siteUrl: config.siteUrl }));
});

r.get('/audit', allow(), async (req, res) => res.json(await AuditLog.find(req.query.entity ? { entity: req.query.entity } : {}).sort({ createdAt: -1 }).limit(200).lean()));

/** Recherche globale : nom client, n° de réservation, excursion */
r.get('/search', allow('manager', 'editor'), async (req, res) => {
  const rx = new RegExp(String(req.query.q || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [bookings, excursions] = await Promise.all([
    Booking.find({ $or: [{ ref: rx }, { 'customer.name': rx }, { 'customer.email': rx }] }).limit(10).select('ref customer.name firstServiceDate status').lean(),
    Excursion.find({ $or: LANGS.map((l) => ({ [`title.${l}`]: rx })) }).limit(10).select('title').lean(),
  ]);
  res.json({ bookings, excursions });
});

export default r;
