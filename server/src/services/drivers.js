import { User } from '../models/index.js';
import { t } from './i18n.js';

/** Chauffeurs des prestations d'une réservation : Map id → { name, phone, vehicle } */
export async function driversFor(b) {
  const ids = [...new Set((b.items || []).map((i) => i.driver?._id || i.driver).filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const list = await User.find({ _id: { $in: ids } }).select('name phone vehicle').lean();
  return new Map(list.map((d) => [String(d._id), d]));
}

/** Chauffeur d'une prestation (populé ou non) */
export function driverOf(item, drivers = new Map()) {
  const d = item?.driver;
  if (!d) return null;
  if (d.name) return d;
  return drivers.get(String(d)) || null;
}

/** « Chauffeur : Ali · +216 … · Toyota Hiace (123 TU 4567) » dans la langue du client */
export function driverLine(d, lang = 'fr') {
  if (!d) return '';
  const v = d.vehicle || {};
  const vehicle = [v.label, v.plate && `(${v.plate})`].filter(Boolean).join(' ');
  return `${t(lang, 'driver')} : ${[d.name, d.phone, vehicle].filter(Boolean).join(' · ')}`;
}
