import mongoose from 'mongoose';
import { L, SeoByLang, TranslationStatus } from './common.js';
import { LANGS } from '../config.js';

const SeasonPrice = new mongoose.Schema({
  minimum: Number,   // M : montant minimum garanti au guide
  adult: Number,     // p : prix réduit par personne (affiché sur les cartes)
  vehicle: Number,   // mode per_vehicle
  flat: Number,      // mode group_flat
}, { _id: false });

const PricingSchema = new mongoose.Schema({
  mode: { type: String, enum: ['per_person', 'minimum', 'per_vehicle', 'group_flat', 'quote'], default: 'minimum' },
  seasons: { low: SeasonPrice, mid: SeasonPrice, high: SeasonPrice },
  childDiscount: { type: Number, default: 0.5 },
  infantDiscount: { type: Number, default: 1 },
  childAges: { type: [Number], default: [4, 11] },
  infantAges: { type: [Number], default: [0, 3] },
  vehicle: { capacity: { type: Number, default: 8 }, price: Number },
  flat: { upTo: Number, price: Number, extraPerPerson: Number },
  maxGroup: { type: Number, default: 8 },
  weekendSupplement: { type: Number, default: 0 },
  zones: [{ _id: false, key: String, label: String, fee: Number }],
  guideLanguages: [{ _id: false, lang: String, fee: Number }],
  options: [{ _id: false, key: String, label: L(), price: Number, per: { type: String, enum: ['person', 'vehicle', 'booking'] } }],
}, { _id: false });

const ExcursionSchema = new mongoose.Schema({
  slug: L(),                 // URL traduite par langue
  slugHistory: [{ _id: false, lang: String, slug: String }], // pour les redirections 301
  title: L(),
  summary: L(),
  description: L(),
  highlights: [L()],
  included: [L()],
  notIncluded: [L()],
  toBring: [L()],
  program: [{ _id: false, time: String, text: L() }],
  faq: [{ _id: false, q: L(), a: L() }],
  durationLabel: L(),
  durationHours: Number,
  category: { type: String, enum: ['culture', 'desert', 'sea', 'adventure', 'family'], index: true },
  departureCities: [String],
  guideLanguages: { type: [String], default: ['fr', 'en'] },
  minAge: { type: Number, default: 0 },
  groupSize: { min: { type: Number, default: 1 }, max: { type: Number, default: 8 } },
  badges: [{ type: String, enum: ['private', 'family', 'bestseller', 'new'] }],
  images: [{ _id: false, url: String, alt: L() }],
  video: String,
  mapEmbed: String,
  startTimes: [String],
  pricing: { type: PricingSchema, default: () => ({}) },
  availability: {
    mode: { type: String, enum: ['instant', 'request'], default: 'request' },
    confirmWithinHours: { type: Number, default: 12 },
    capacityPerDay: { type: Number, default: 3 },     // nombre de groupes par jour
    closedWeekdays: [Number],                        // 0 = dimanche
    blockedDates: [String],                          // YYYY-MM-DD
    minNoticeHours: { type: Number, default: 24 },
  },
  cancellationFreeHours: { type: Number, default: 24 },
  seo: { type: SeoByLang(), default: () => ({}) },
  translation: { type: TranslationStatus(), default: () => ({}) },
  published: { type: Boolean, default: false },
  publishedLangs: [String],
  popularity: { type: Number, default: 0 },
  rating: { value: Number, count: Number },
  related: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Excursion' }],
}, { timestamps: true });

for (const l of LANGS) ExcursionSchema.index({ [`slug.${l}`]: 1 });
ExcursionSchema.index({ 'title.en': 'text', 'title.fr': 'text', 'title.de': 'text', 'title.it': 'text', 'title.es': 'text', 'summary.en': 'text', 'summary.fr': 'text' });

export const Excursion = mongoose.model('Excursion', ExcursionSchema);
