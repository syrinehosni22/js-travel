import cron from 'node-cron';
import { Booking } from './models/index.js';
import { refreshRates } from './services/settings.js';
import { notifyStatus, requestReview } from './services/notify.js';

/** Tâches planifiées (heure de Tunis) */
export function startJobs() {
  const tz = { timezone: 'Africa/Tunis' };

  // Taux de change : chaque jour à 6 h
  cron.schedule('0 6 * * *', refreshRates, tz);

  // Rappel J-1 (WhatsApp + e-mail) à 18 h
  cron.schedule('0 18 * * *', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const list = await Booking.find({ firstServiceDate: tomorrow, status: 'confirmed', reminderSent: { $ne: true } });
    for (const b of list) {
      await notifyStatus(b, 'reminder');
      b.reminderSent = true;
      await b.save();
    }
  }, tz);

  // Demande d'avis Tripadvisor / Google le lendemain de la prestation, à 11 h
  cron.schedule('0 11 * * *', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const list = await Booking.find({ firstServiceDate: { $lte: yesterday }, status: { $in: ['paid_on_site', 'completed'] }, reviewRequested: { $ne: true } });
    for (const b of list) {
      await requestReview(b);
      b.reviewRequested = true;
      await b.save();
    }
  }, tz);
}
