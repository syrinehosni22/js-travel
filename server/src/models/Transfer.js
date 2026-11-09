import mongoose from 'mongoose';
import { L, SeoByLang } from './common.js';

/** Lieu proposé dans la recherche de trajet : aéroport, ville ou hôtel, rattaché à une zone */
const LocationSchema = new mongoose.Schema({
  name: { type: String, required: true },     // identifiant / nom saisi dans l'admin
  label: L(),                                  // nom affiché dans chaque langue (repli : name)
  type: { type: String, enum: ['airport', 'city', 'hotel'], default: 'hotel' },
  zone: { type: String, required: true, index: true },   // clé de zone
  meetingPoint: L(),
  active: { type: Boolean, default: true },
});
LocationSchema.index({ name: 'text' });
export const Location = mongoose.model('Location', LocationSchema);

export const Zone = mongoose.model('Zone', new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  label: L(),
}));

/** Configuration unique des transferts : véhicules, grille, suppléments (§4.3) */
export const TransferConfig = mongoose.model('TransferConfig', new mongoose.Schema({
  vehicles: [{ _id: false, key: String, label: L(), maxPassengers: Number, maxLuggage: Number, perKm: Number, minFare: Number }],
  grid: [{ _id: false, fromZone: String, toZone: String, vehicle: String, price: Number }],
  supplements: {
    nightPercent: { type: Number, default: 20 }, nightFrom: { type: Number, default: 22 }, nightTo: { type: Number, default: 6 },
    childSeat: { type: Number, default: 5 }, nameSign: { type: Number, default: 0 }, extraStop: { type: Number, default: 10 },
    waitingPerHour: { type: Number, default: 15 }, includedWaitingMin: { type: Number, default: 60 },
  },
  returnDiscount: { type: Number, default: 10 },
  minNoticeHours: { type: Number, default: 12 },
  hourlyHire: { pricePerHour: Number, pricePerDay: Number },
}, { timestamps: true }));

/** Page de destination SEO pour un trajet (ex. « Transfert aéroport Enfidha – Sousse ») */
export const TransferRoute = mongoose.model('TransferRoute', new mongoose.Schema({
  fromZone: String, toZone: String,
  slug: L(), title: L(), description: L(),
  seo: { type: SeoByLang(), default: () => ({}) },
  published: { type: Boolean, default: false },
}, { timestamps: true }));
