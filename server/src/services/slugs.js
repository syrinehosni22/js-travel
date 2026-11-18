import { Excursion } from '../models/index.js';
import { LANGS } from '../config.js';
import { planSlugRepairs } from '../lib/slugs.js';

/** Au démarrage : corrige les fiches qui partagent la même adresse ou ont gardé « nouvelle-excursion » */
export async function repairExcursionSlugs() {
  const docs = await Excursion.find().select('slug title createdAt').sort({ createdAt: 1, _id: 1 }).lean();
  const changes = await planSlugRepairs(docs, LANGS);
  for (const c of changes) {
    await Excursion.updateOne({ _id: c.id }, { $set: { [`slug.${c.lang}`]: c.to } });
    console.log(`[slugs] excursion ${c.id} (${c.lang}) : ${c.from} → ${c.to}`);
  }
  return changes;
}
