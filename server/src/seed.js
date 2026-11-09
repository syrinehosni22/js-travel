/**
 * Données de démarrage (le contenu est dans seed-data.js).
 *   npm run seed            → crée l'admin, ajoute ce qui manque et complète les traductions manquantes
 *   npm run seed -- --reset → vide la base puis la remplit
 *
 * Remarque : le serveur fait déjà tout cela automatiquement au démarrage si la base est vide,
 * et crée toujours le compte administrateur s'il n'existe pas.
 */
import mongoose from 'mongoose';
import { config } from './config.js';
import { runSeed } from './seed-data.js';

async function main() {
  console.log('Base utilisée :', config.mongoUri.replace(/\/\/.*@/, '//***@'));
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  await runSeed({ reset: process.argv.includes('--reset') });
  await mongoose.disconnect();
  console.log('Terminé.');
}

main().catch((e) => {
  console.error(e);
  if (/ECONNREFUSED|Server selection timed out/i.test(String(e?.message))) {
    console.error('\n→ MongoDB ne répond pas. Démarrez MongoDB ou vérifiez MONGODB_URI dans server/.env');
  }
  process.exit(1);
});
