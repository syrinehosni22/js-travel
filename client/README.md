# JS Travel Tunisia — client (site + back-office)

React 18 · Vite · i18next (5 langues). Projet autonome : il appelle l'API par HTTP.

```bash
npm install
npm run dev        # http://localhost:5173 — /api envoyé vers VITE_DEV_API (défaut http://localhost:4000)
npm test           # pages + traductions complètes dans les 5 langues
npm run build      # fichiers statiques dans dist/ (à servir avec Nginx)
./deploy.sh        # production : build + copie dans /var/www/js-travel
```

Variables (`.env`, voir `.env.example`) :
- `VITE_API_URL` — adresse de l'API si elle est sur un autre domaine (vide = même domaine via Nginx)
- `VITE_DEV_API` — adresse de l'API en développement
- `VITE_GTM_ID`, `VITE_LOCAL_IMAGES`

`src/lib/pricing.js` et `src/lib/seo.js` sont des copies de `server/src/lib/` : garder les deux identiques.
