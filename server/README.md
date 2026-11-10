# JS Travel Tunisia — server (API)

Node.js 20+ · Express 5 · MongoDB (Mongoose). Projet autonome : ne sert pas le site, seulement `/api`, `/uploads`, `/sitemap.xml`, `/robots.txt`.

```bash
npm install
cp .env.example .env     # MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, SITE_URL, CORS_ORIGIN…
npm run dev              # http://localhost:4000 (redémarre à chaque modification)
npm test                 # moteur de prix
npm run seed             # données de démonstration (déjà automatique si la base est vide)
npm run create-admin -- email@exemple.com MotDePasse123   # créer / réinitialiser un admin
```

Production : `pm2 start ecosystem.config.cjs && pm2 save`, puis `./deploy.sh` à chaque mise à jour.
Santé : `GET /api/health` → `{ "ok": true, "db": true }`.

Au démarrage, le compte administrateur est créé s'il n'existe pas, et la base est remplie si elle est vide.
`SITE_URL` = adresse publique du site (liens des e-mails, sitemap) ; `CORS_ORIGIN` = adresse du site si l'API est sur un autre domaine.
