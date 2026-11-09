/**
 * Crée l'administrateur ou réinitialise son mot de passe, sans démarrer le site.
 * (Le serveur crée déjà l'admin automatiquement au démarrage ; ce script sert en cas de mot de passe oublié.)
 *   npm run create-admin -w server
 *   npm run create-admin -w server -- email@exemple.com MonMotDePasse123
 */
import mongoose from 'mongoose';
import { config } from './config.js';
import { ensureAdmin } from './seed-data.js';

const [email, password] = process.argv.slice(2);
if (email) process.env.ADMIN_EMAIL = email;
if (password) process.env.ADMIN_PASSWORD = password;
process.env.ADMIN_RESET = 'true';

console.log('Base utilisée :', config.mongoUri.replace(/\/\/.*@/, '//***@'));
await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
await ensureAdmin();
console.log(`\nConnectez-vous sur /admin avec :\n  E-mail       : ${(process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase()}\n  Mot de passe : ${process.env.ADMIN_PASSWORD || 'ChangeMoi123!'}`);
await mongoose.disconnect();
