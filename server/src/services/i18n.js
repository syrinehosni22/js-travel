/** Textes des e-mails, WhatsApp et bons PDF, dans les 5 langues (§6). */
const T = {
  en: {
    received: 'Booking request received', confirmed: 'Booking confirmed', cancelled: 'Booking cancelled', reminder: 'See you tomorrow!',
    review: 'How was your trip?', hello: 'Hello', ref: 'Booking reference', total: 'Total to pay on site',
    pending: 'Our team will confirm within a few hours.', manage: 'View or cancel your booking',
    voucher: 'Voucher', ttc: 'incl. taxes', pickup: 'Pick-up', dropoff: 'Drop-off', flight: 'flight', date: 'Date', people: 'Participants', driver: 'Driver',
    reviewAsk: 'Your opinion helps other travellers. Could you leave us a review?', thanks: 'Thank you!',
    adults: 'adults', children: 'children', infants: 'infants', adult: 'adult', child: 'child', infant: 'infant', payOnSite: 'Payment on site on the day of the service',
  },
  fr: {
    received: 'Demande de réservation reçue', confirmed: 'Réservation confirmée', cancelled: 'Réservation annulée', reminder: 'À demain !',
    review: 'Votre excursion s’est bien passée ?', hello: 'Bonjour', ref: 'Référence', total: 'Total à régler sur place',
    pending: 'Notre équipe confirme votre demande sous quelques heures.', manage: 'Voir ou annuler ma réservation',
    voucher: 'Bon de réservation', ttc: 'TTC', pickup: 'Prise en charge', dropoff: 'Destination', flight: 'vol', date: 'Date', people: 'Participants', driver: 'Chauffeur',
    reviewAsk: 'Votre avis aide d’autres voyageurs. Pouvez-vous nous en laisser un ?', thanks: 'Merci !',
    adults: 'adultes', children: 'enfants', infants: 'bébés', adult: 'adulte', child: 'enfant', infant: 'bébé', payOnSite: 'Paiement sur place le jour de la prestation',
  },
  de: {
    received: 'Buchungsanfrage erhalten', confirmed: 'Buchung bestätigt', cancelled: 'Buchung storniert', reminder: 'Bis morgen!',
    review: 'Wie war Ihr Ausflug?', hello: 'Hallo', ref: 'Buchungsnummer', total: 'Vor Ort zu zahlen',
    pending: 'Unser Team bestätigt innerhalb weniger Stunden.', manage: 'Buchung ansehen oder stornieren',
    voucher: 'Gutschein', ttc: 'inkl. Steuern', pickup: 'Abholung', dropoff: 'Ziel', flight: 'Flug', date: 'Datum', people: 'Teilnehmer', driver: 'Fahrer',
    reviewAsk: 'Ihre Meinung hilft anderen Reisenden. Hinterlassen Sie uns eine Bewertung?', thanks: 'Danke!',
    adults: 'Erwachsene', children: 'Kinder', infants: 'Babys', adult: 'Erwachsener', child: 'Kind', infant: 'Baby', payOnSite: 'Zahlung vor Ort am Tag der Leistung',
  },
  it: {
    received: 'Richiesta di prenotazione ricevuta', confirmed: 'Prenotazione confermata', cancelled: 'Prenotazione annullata', reminder: 'A domani!',
    review: 'Com’è andata l’escursione?', hello: 'Ciao', ref: 'Codice prenotazione', total: 'Totale da pagare sul posto',
    pending: 'Il nostro team conferma entro poche ore.', manage: 'Vedi o annulla la prenotazione',
    voucher: 'Voucher', ttc: 'tasse incluse', pickup: 'Ritiro', dropoff: 'Destinazione', flight: 'volo', date: 'Data', people: 'Partecipanti', driver: 'Autista',
    reviewAsk: 'La tua opinione aiuta altri viaggiatori. Ci lasci una recensione?', thanks: 'Grazie!',
    adults: 'adulti', children: 'bambini', infants: 'neonati', adult: 'adulto', child: 'bambino', infant: 'neonato', payOnSite: 'Pagamento sul posto il giorno del servizio',
  },
  es: {
    received: 'Solicitud de reserva recibida', confirmed: 'Reserva confirmada', cancelled: 'Reserva cancelada', reminder: '¡Hasta mañana!',
    review: '¿Qué tal la excursión?', hello: 'Hola', ref: 'Referencia', total: 'Total a pagar en destino',
    pending: 'Nuestro equipo confirmará en pocas horas.', manage: 'Ver o cancelar mi reserva',
    voucher: 'Bono', ttc: 'impuestos incluidos', pickup: 'Recogida', dropoff: 'Destino', flight: 'vuelo', date: 'Fecha', people: 'Participantes', driver: 'Conductor',
    reviewAsk: 'Tu opinión ayuda a otros viajeros. ¿Nos dejas una reseña?', thanks: '¡Gracias!',
    adults: 'adultos', children: 'niños', infants: 'bebés', adult: 'adulto', child: 'niño', infant: 'bebé', payOnSite: 'Pago en destino el día del servicio',
  },
};
export const t = (lang, key) => (T[lang] || T.en)[key] || T.en[key] || key;
