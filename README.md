# JS Travel Tunisia — excursions privées et transferts

Deux projets **totalement indépendants**, chacun avec son `package.json`, ses dépendances et son `.env` :

```
js-travel/
├── client/    Site public + back-office (React / Vite)   → fichiers statiques (dist/)
├── server/    API (Node.js / Express / MongoDB)            → port 4000
├── deploy/    Configuration Nginx du serveur de production
└── docker-compose.yml   (optionnel : MongoDB + API + site en conteneurs)
```

Le client parle à l'API uniquement par HTTP (`/api/...`). Rien n'est importé d'un projet à l'autre :
le calcul des prix et les règles SEO existent en deux exemplaires identiques
(`client/src/lib/` et `server/src/lib/`) — **si vous modifiez l'un, recopiez-le dans l'autre**.

## Démarrer en local (2 terminaux)

Prérequis : Node.js 20+, MongoDB 7+ (local ou MongoDB Atlas).

```bash
# Terminal 1 — API
cd server
npm install
cp .env.example .env        # puis remplir les valeurs
npm run dev                 # http://localhost:4000

# Terminal 2 — site
cd client
npm install
npm run dev                 # http://localhost:5173 (les appels /api sont envoyés au port 4000)
```

- Site : http://localhost:5173 · Back-office : http://localhost:5173/admin
- Au premier démarrage, l'API crée seule le compte administrateur (`ADMIN_EMAIL` / `ADMIN_PASSWORD` du `server/.env`)
  et, si la base est vide, les données de démonstration dans les 5 langues.
- Tests : `cd server && npm test` (moteur de prix) · `cd client && npm test` (pages et traductions)

## Production (un seul serveur Ubuntu + Nginx)

```bash
# API
cd server && npm install --omit=dev && cp .env.example .env && nano .env
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup

# Site
cd ../client && npm install && npm run build
sudo mkdir -p /var/www/js-travel && sudo cp -r dist/* /var/www/js-travel/

# Nginx : sert le site et renvoie /api, /uploads, sitemap.xml, robots.txt vers l'API
sudo cp ../deploy/nginx-js-travel.conf /etc/nginx/sites-available/js-travel
sudo ln -sf /etc/nginx/sites-available/js-travel /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl reload nginx
```

Mises à jour : `cd server && ./deploy.sh` (API) et `cd client && ./deploy.sh` (site), indépendamment.

API sur un **autre domaine** que le site (ex. `api.mon-site.com`) : mettre `VITE_API_URL=https://api.mon-site.com`
dans `client/.env` avant `npm run build`, et l'adresse du site dans `CORS_ORIGIN` du `server/.env`.

Avec Docker : `docker compose up -d --build` (site sur le port 80).

### Traductions
- **Saisie en français uniquement** dans l'admin : l'anglais, l'allemand, l'italien et l'espagnol sont remplis automatiquement à l'enregistrement.
- Service : DeepL si `DEEPL_API_KEY` est renseigné dans `server/.env` (recommandé), sinon MyMemory (gratuit, quota limité).

## Identité visuelle

Logo JS Travel Tunisia dans `client/public/brand/` (emblème clair, emblème blanc pour fonds sombres, logo complet, favicons, image de partage). Couleurs du logo : bleu marine `#14213D`, or `#C9A227`, crème `#F6F1E7`. Typographies : Cormorant Garamond (titres) et Jost (texte). Pour une version vectorielle (SVG) du logo, la fournir et remplacer `emblem.png`.

## Photos

13 photos libres de droits (licence Unsplash, usage commercial autorisé) de lieux tunisiens vérifiés : Sidi Bou Saïd, Carthage, Ksar Ghilane, Djerba, El Jem, Sousse, Mahdia, Tataouine. Liste, crédits et emplacements : **client/IMAGES.md**.
Elles sont servies en tailles adaptées à chaque écran (640 à 2400 px, WebP/AVIF automatique). Pour les héberger sur votre serveur : `cd client && npm run images` puis `VITE_LOCAL_IMAGES=1 npm run build`.

## Ce qui est couvert

| Cahier des charges | Où |
|---|---|
| §3 Calculateur (5 modes, minimum garanti, seuil, saisons, enfants/bébés, zones, langue du guide, options par personne/véhicule/réservation, remises, devises) | `server/src/lib/pricing.js` (copie dans `client/src/lib/`), `PriceCalculator.jsx` |
| §3.5 Prix recalculé côté serveur et figé dans la réservation | `services/booking.js` → `createBooking` |
| §3.6 Admin : M et p par saison, seuil calculé, alerte minimum inatteignable, simulateur, historique des prix | `admin/Excursions.jsx` (onglet Tarifs) |
| §4 Transferts : lieux + saisie semi-automatique, grille par zones et véhicule, choix du véhicule selon passagers/bagages, nuit, siège enfant, panneau, aller-retour, délai minimum, vente croisée | `TransferForm.jsx`, `Transfers.jsx`, `admin/Transfers.jsx` |
| §5 Panier commun excursions + transferts, réservation sans paiement, confirmation, bon PDF, .ics, espace client (voir, modifier, annuler), liste d'attente, blocage des absents | `Cart.jsx`, `Checkout.jsx`, `BookingView.jsx` |
| §5.4 Disponibilités : capacité par jour, jours fermés, dates bloquées, confirmation instantanée ou sur demande | modèle `Excursion.availability`, calendrier de la fiche |
| §6 5 langues, URL traduites, hreflang, détection + mémorisation, devises EUR/GBP/TND (taux quotidien ou manuel), écran de traduction côte à côte, pré-traduction DeepL, statut « relu » | `i18n.js`, `admin/Excursions.jsx` |
| §7 Admin : tableau de bord + alertes, réservations (statuts, montant encaissé, actions groupées, filtres enregistrés, export CSV), planning jour/semaine avec glisser-déposer des chauffeurs, rôles, 2FA, journal des actions, recherche globale | `admin/*`, `routes/admin.js` |
| §7.3 Notifications : équipe (e-mail + WhatsApp), client (confirmation, rappel J-1, chauffeur, annulation, avis), feuille de route chauffeur | `services/notify.js`, `jobs.js` |
| §8 SEO : onglet SEO par langue, compteurs, aperçu Google, score, publication bloquée si incomplet, mot-clé unique, 301 automatiques, sitemap avec hreflang, données structurées (TouristTrip/Product, FAQPage, BreadcrumbList, LocalBusiness) | `server/src/lib/seo.js` (copie dans `client/src/lib/`), `routes/seo.js`, `components/ui.jsx` (`Seo`) |
| Cookies Consent Mode v2 + GTM, WhatsApp flottant, retour en haut, anti-spam (champ piège + Cloudflare Turnstile) | `Layout.jsx`, `middleware.js` |

## Points à compléter avant la mise en ligne

1. **Référencement / Core Web Vitals.** Le site est une application React rendue dans le navigateur. Google l'indexe, mais pour viser un référencement solide dans 5 langues et des Core Web Vitals au vert, il faut ajouter un **pré-rendu** des pages publiques (ex. `vite-plugin-ssr`/Vike) ou migrer le site public vers **Next.js**. Les composants et l'API sont réutilisables tels quels.
2. **WhatsApp.** L'API WhatsApp Cloud n'autorise les messages texte libres que dans les 24 h suivant un message du client. Pour les confirmations et rappels, il faut créer et faire valider des **modèles de messages** dans Meta Business, puis adapter `sendWhatsApp` (type `template`).
3. **Widget d'avis Tripadvisor + Google** : coller le script du prestataire choisi dans l'emplacement `#reviews-widget` (accueil).
4. **Google Search Console** (clics et position dans le tableau SEO) et **Google Places** (adresses libres + distance pour le prix au km) : non branchés ; le moteur de prix gère déjà le calcul au km si la distance est fournie.
5. **Traductions** : interface complète dans les 5 langues ; contenu saisi en français et traduit automatiquement (DeepL recommandé). Les traductions DE/IT/ES sont à faire relire.
6. **Prix d'exemple** : seuls ceux de Carthage viennent du cahier des charges ; tous les autres (excursions, grille de transferts) sont à remplacer dans le back-office.
7. **Compte client** : l'espace client fonctionne par lien sécurisé envoyé par e-mail (sans mot de passe). Un compte avec mot de passe est à ajouter si souhaité.
8. **Stockage des photos** : sur le disque du serveur (`server/uploads`). Pour plusieurs serveurs, passer à S3 ou Cloudinary.
9. **Non développés** : réservation de la « mise à disposition à l'heure » (tarifs saisis, parcours absent), suivi de vol en direct, formation et vidéo.

Démarrage, création de l'admin, connexion au back-office et pages publiques dans les 5 langues vérifiés contre une base compatible MongoDB (FerretDB). Faire un passage complet (réservation, e-mails) sur votre MongoDB avant la mise en production.
