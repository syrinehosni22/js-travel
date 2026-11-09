import mongoose from 'mongoose';
import { LANGS } from '../config.js';

/** Champ traduit dans les 5 langues : { en, fr, de, it, es } */
export const L = () => new mongoose.Schema(Object.fromEntries(LANGS.map((l) => [l, { type: String, default: '' }])), { _id: false });

/** Fiche SEO d'une langue (§8.2) */
export const SeoSchema = new mongoose.Schema({
  focusKeyword: { type: String, default: '' },
  secondaryKeywords: [String],
  metaTitle: { type: String, default: '' },
  metaDescription: { type: String, default: '' },
  h1: { type: String, default: '' },
  ogImage: String,
  ogTitle: String,
  ogDescription: String,
  canonical: String,
  index: { type: Boolean, default: true },
}, { _id: false });

export const SeoByLang = () => new mongoose.Schema(Object.fromEntries(LANGS.map((l) => [l, { type: SeoSchema, default: () => ({}) }])), { _id: false });

/** Statut de traduction par langue : missing | auto (DeepL, à relire) | reviewed */
export const TranslationStatus = () => new mongoose.Schema(
  Object.fromEntries(LANGS.map((l) => [l, { type: String, enum: ['missing', 'auto', 'reviewed'], default: 'missing' }])), { _id: false });
