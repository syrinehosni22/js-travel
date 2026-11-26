import { User, FleetVehicle } from '../models/index.js';
import { t } from './i18n.js';

const idsOf = (b, key) => [...new Set((b.items || []).map((i) => i[key]?._id || i[key]).filter(Boolean).map(String))];

/**
 * Chauffeurs et véhicules des prestations d'une réservation : Map id → fiche.
 * Les véhicules sont rangés dans la même Map sous la clé « v:<id> ».
 */
export async function driversFor(b) {
  const [dIds, vIds] = [idsOf(b, 'driver'), idsOf(b, 'vehicle')];
  const [drivers, vehicles] = await Promise.all([
    dIds.length ? User.find({ _id: { $in: dIds } }).select('name phone').lean() : [],
    vIds.length ? FleetVehicle.find({ _id: { $in: vIds } }).select('label plate capacity').lean() : [],
  ]);
  return new Map([...drivers.map((d) => [String(d._id), d]), ...vehicles.map((v) => [`v:${v._id}`, v])]);
}

/** Véhicule d'une prestation (populé ou non) */
export function vehicleOf(item, map = new Map()) {
  const v = item?.vehicle;
  if (!v) return null;
  if (v.label) return v;
  return map.get(`v:${v}`) || null;
}

/** Chauffeur d'une prestation (populé ou non) */
export function driverOf(item, drivers = new Map()) {
  const d = item?.driver;
  if (!d) return null;
  if (d.name) return d;
  return drivers.get(String(d)) || null;
}

/** « Toyota Hiace (123 TU 4567) » */
export const vehicleText = (v) => (v ? [v.label, v.plate && `(${v.plate})`].filter(Boolean).join(' ') : '');

/**
 * « Chauffeur : Ali · +216 … · Toyota Hiace (123 TU 4567) » dans la langue du client.
 * Le véhicule est celui choisi pour la prestation (pas lié au chauffeur).
 */
export function driverLine(d, lang = 'fr', vehicle = null) {
  if (!d && !vehicle) return '';
  if (!d) return `${t(lang, 'vehicle')} : ${vehicleText(vehicle)}`;
  return `${t(lang, 'driver')} : ${[d.name, d.phone, vehicleText(vehicle)].filter(Boolean).join(' · ')}`;
}

/** Ligne chauffeur + véhicule d'une prestation */
export const staffLine = (item, map, lang) => driverLine(driverOf(item, map), lang, vehicleOf(item, map));
