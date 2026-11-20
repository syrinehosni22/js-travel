import mongoose from 'mongoose';

/**
 * Avis client sur une excursion : note de 1 à 5 étoiles + commentaire.
 * Un avis déposé sur le site est « en attente » et n'est publié qu'après validation dans l'admin.
 */
export const Review = mongoose.model('Review', new mongoose.Schema({
  excursion: { type: mongoose.Schema.Types.ObjectId, ref: 'Excursion', index: true },   // absent = avis sur le site
  scope: { type: String, enum: ['excursion', 'site'], default: 'excursion', index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },   // jamais affiché sur le site
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true },
  lang: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reply: { type: String, trim: true },                    // réponse de l'équipe, affichée sous l'avis
}, { timestamps: true }));
