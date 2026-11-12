import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Toujours lire server/.env, quel que soit le dossier depuis lequel on lance la commande (API, seed, import…)
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
dotenv.config();

export const config = {
  port: +process.env.PORT || 4000,
  env: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tunisia-tours',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  siteUrl: (process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, ''),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  smtp: {
    host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587,
    user: process.env.SMTP_USER, pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'JS Travel Tunisia <reservations@example.com>',
  },
  teamEmail: process.env.TEAM_EMAIL,
  whatsapp: { token: process.env.WHATSAPP_TOKEN, phoneId: process.env.WHATSAPP_PHONE_ID, team: process.env.TEAM_WHATSAPP },
  turnstileSecret: process.env.TURNSTILE_SECRET,
  deeplKey: process.env.DEEPL_API_KEY,
  fxMode: process.env.FX_MODE || 'auto',
};

export const LANGS = ['en', 'fr', 'de', 'it', 'es'];
export const DEFAULT_LANG = 'en';
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'TND'];
