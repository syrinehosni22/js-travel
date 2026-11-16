import { Excursion } from '../models/index.js';
import { Review } from '../models/Review.js';

/** Recalcule la note moyenne et le nombre d'avis publiés d'une excursion (étoiles de la fiche et de Google). */
export async function refreshRating(excursionId) {
  const [agg] = await Review.aggregate([
    { $match: { excursion: excursionId, status: 'approved' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const rating = agg?.count ? { value: Math.round(agg.avg * 10) / 10, count: agg.count } : { value: null, count: 0 };
  await Excursion.updateOne({ _id: excursionId }, { $set: { rating } });
  return rating;
}

/** Avis tel qu'affiché sur le site (sans e-mail). */
export const publicReview = (r) => ({ id: r._id, name: r.name, rating: r.rating, comment: r.comment || '', reply: r.reply || '', lang: r.lang, createdAt: r.createdAt });
