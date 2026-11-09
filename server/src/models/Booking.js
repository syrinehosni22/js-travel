import mongoose from 'mongoose';
import crypto from 'node:crypto';

const PriceLine = new mongoose.Schema({ key: String, label: String, option: String, qty: Number, unit: Number, amount: Number, rate: Number, source: String }, { _id: false });

const ItemSchema = new mongoose.Schema({
  type: { type: String, enum: ['excursion', 'transfer'], required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'waitlist'], default: 'pending' },
  // Excursion
  excursion: { type: mongoose.Schema.Types.ObjectId, ref: 'Excursion' },
  title: String,
  date: String,           // YYYY-MM-DD
  time: String,
  participants: { adult: Number, child: Number, infant: Number },
  zone: String,
  guideLang: String,
  options: [String],
  // Transfert
  transfer: {
    from: String, fromZone: String, to: String, toZone: String,
    datetime: Date, flightNumber: String, vehicle: String, luggage: Number,
    childSeats: Number, nameSign: Boolean, extraStops: Number,
    roundTrip: Boolean, returnDatetime: Date, returnFlightNumber: String,
  },
  // Prix figé, recalculé côté serveur
  season: String,
  lines: [PriceLine],
  totalEur: Number,
  // Opérations
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  vehiclePlate: String,
});

const BookingSchema = new mongoose.Schema({
  ref: { type: String, unique: true, index: true },
  token: { type: String, default: () => crypto.randomBytes(16).toString('hex') }, // lien client
  status: { type: String, enum: ['new', 'confirmed', 'paid_on_site', 'completed', 'cancelled', 'no_show'], default: 'new', index: true },
  items: [ItemSchema],
  customer: {
    name: { type: String, required: true }, email: { type: String, required: true, lowercase: true, index: true },
    phone: String, hotel: String, room: String, notes: String,
  },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  lang: { type: String, default: 'en' },
  currency: { type: String, default: 'EUR' },
  rate: { type: Number, default: 1 },
  totalEur: Number,          // montant à régler sur place, en EUR
  totalDisplay: Number,      // dans la devise affichée au client
  collectedAmount: Number,   // saisi par l'équipe
  collectedCurrency: String,
  promoCode: String,
  partner: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  channel: { type: String, default: 'web' },  // web | whatsapp | phone | partner
  consent: { terms: Boolean, cancellation: Boolean, at: Date, ip: String },
  firstServiceDate: { type: String, index: true },
  reminderSent: Boolean,
  reviewRequested: Boolean,
  history: [{ _id: false, at: { type: Date, default: Date.now }, by: String, action: String, note: String }],
}, { timestamps: true });

BookingSchema.pre('save', async function () {
  if (!this.ref) {
    const y = new Date().getFullYear().toString().slice(2);
    this.ref = `TT${y}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }
  const dates = this.items.map((i) => i.date || (i.transfer?.datetime && i.transfer.datetime.toISOString().slice(0, 10))).filter(Boolean).sort();
  this.firstServiceDate = dates[0];
});

export const Booking = mongoose.model('Booking', BookingSchema);

/** Liste d'attente quand une date est complète (§5.4) */
export const Waitlist = mongoose.model('Waitlist', new mongoose.Schema({
  excursion: { type: mongoose.Schema.Types.ObjectId, ref: 'Excursion' },
  date: String, email: String, name: String, phone: String, participants: Number, lang: String, notified: Boolean,
}, { timestamps: true }));
