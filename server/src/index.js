import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import publicRoutes from './routes/public.js';
import adminRoutes, { UPLOAD_DIR } from './routes/admin.js';
import seoRoutes from './routes/seo.js';
import { errorHandler, apiNotFound } from './middleware.js';
import { startJobs } from './jobs.js';
import { refreshRates } from './services/settings.js';
import { bootstrap } from './seed-data.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '2mb' }));
if (config.env !== 'test') app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use(seoRoutes);
app.use('/api', apiNotFound);

// Le front React est un projet séparé (dossier client/), servi par Nginx ou un hébergeur statique.

app.use(errorHandler);

async function main() {
  console.log('[db] connexion à', config.mongoUri.replace(/\/\/.*@/, '//***@'), '…');
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('[db] connecté à la base', mongoose.connection.name);
  // Crée automatiquement le compte administrateur (et les données de démarrage si la base est vide)
  await bootstrap();
  app.listen(config.port, () => console.log(`[api] http://localhost:${config.port}`));
  startJobs();
  refreshRates();
}

// Démarrage direct (node src/index.js) ou via PM2, qui lance le fichier à travers son propre script
const thisFile = fileURLToPath(import.meta.url);
const launchedAs = [process.argv[1], process.env.pm_exec_path].filter(Boolean).map((p) => path.resolve(p));
if (launchedAs.includes(thisFile)) {
  main().catch((e) => {
    console.error(e);
    if (/ECONNREFUSED|Server selection timed out/i.test(String(e?.message))) {
      console.error('\n→ MongoDB ne répond pas. Démarrez MongoDB ou vérifiez MONGODB_URI dans server/.env');
    }
    process.exit(1);
  });
}

export default app;
