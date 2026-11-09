import mongoose from 'mongoose';
import { L, SeoByLang, TranslationStatus } from './common.js';

export { Excursion } from './Excursion.js';
export { Location, Zone, TransferConfig, TransferRoute } from './Transfer.js';
export { Booking, Waitlist } from './Booking.js';

/** Équipe : administrateur, gestionnaire, rédacteur, chauffeur, partenaire (§7.2) */
export const ROLES = ['admin', 'manager', 'editor', 'driver', 'partner'];
export const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ROLES, default: 'manager' },
  phone: String,
  partner: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  twoFactorSecret: String,
  twoFactorEnabled: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  savedFilters: [{ _id: false, name: String, query: Object }],
  vehicle: { label: String, plate: String, capacity: Number },
  unavailableDates: [String],
}, { timestamps: true }));

/** Compte client facultatif (§5.3) */
export const Customer = mongoose.model('Customer', new mongoose.Schema({
  email: { type: String, unique: true, lowercase: true },
  name: String, phone: String, passwordHash: String, lang: String,
  noShowCount: { type: Number, default: 0 },
  blocked: { type: Boolean, default: false },
}, { timestamps: true }));

export const Promo = mongoose.model('Promo', new mongoose.Schema({
  code: { type: String, unique: true, uppercase: true, trim: true },
  percent: { type: Number, min: 0, max: 100 },
  active: { type: Boolean, default: true },
  validFrom: Date, validTo: Date,
  appliesTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Excursion' }],
  maxUses: Number, uses: { type: Number, default: 0 },
}, { timestamps: true }));

export const Partner = mongoose.model('Partner', new mongoose.Schema({
  name: String, type: { type: String, enum: ['hotel', 'agency'] },
  discountPercent: { type: Number, default: 0 },
  commissionPercent: { type: Number, default: 10 },
  trackingCode: { type: String, unique: true, sparse: true },
  contact: { email: String, phone: String },
}, { timestamps: true }));

/** Paramètres globaux (document unique) */
export const Settings = mongoose.model('Settings', new mongoose.Schema({
  calendar: {
    seasons: [{ _id: false, name: { type: String, enum: ['low', 'mid', 'high'] }, from: String, to: String }],
    holidays: [String],
    blocked: [String],
  },
  earlyBooking: { daysBefore: Number, percent: Number },
  fx: { mode: { type: String, default: 'auto' }, GBP: Number, TND: Number, updatedAt: Date },
  contact: { phone: String, whatsapp: String, viber: String, email: String, address: String, mapEmbed: String },
  social: { tripadvisor: String, facebook: String, instagram: String, tiktok: String, googleReviews: String },
  reviews: { rating: Number, count: Number },
  cancellationHours: { type: Number, default: 24 },
  noShowBlockAfter: { type: Number, default: 2 },
  faq: [{ _id: false, q: L(), a: L() }],
  legal: { privacy: L(), cancellation: L(), terms: L() },
  emailTemplates: Object,   // surcharges par clé et par langue
  seoHome: { type: SeoByLang(), default: () => ({}) },
}, { timestamps: true }));

export const Post = mongoose.model('Post', new mongoose.Schema({
  slug: L(), title: L(), excerpt: L(), body: L(),
  category: String, image: String, imageAlt: L(),
  seo: { type: SeoByLang(), default: () => ({}) },
  translation: { type: TranslationStatus(), default: () => ({}) },
  published: { type: Boolean, default: false }, publishedAt: Date,
}, { timestamps: true }));

export const Message = mongoose.model('Message', new mongoose.Schema({
  name: String, email: String, phone: String, subject: String, message: String, lang: String,
  consent: Boolean, handled: { type: Boolean, default: false },
}, { timestamps: true }));

/** Journal des actions : qui a modifié quoi et quand (§7.2), y compris l'historique des prix (§3.6) */
export const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  action: String, entity: String, entityId: String,
  before: Object, after: Object,
}, { timestamps: true }));

/** Redirections 301 automatiques quand une URL change (§8.1) */
export const Redirect = mongoose.model('Redirect', new mongoose.Schema({
  from: { type: String, unique: true }, to: String,
}, { timestamps: true }));
