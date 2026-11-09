# Plateforme excursions et transferts — Tunisie

React (Vite) + Node.js (Express) + MongoDB (Mongoose). Design : direction D « Voyage classique ».

```
tunisia-tours/
├── shared/          Moteur de prix + règles SEO, utilisés par le site ET l'API (mêmes calculs partout)
│   ├── pricing.js   §3 et §4.3 : minimum garanti, saisons, enfants, zones, options, remises, devises, transferts
│   ├── seo.js       §8.2 : slug, champs obligatoires, score « à la Yoast »
│   └── pricing.test.js
├── server/          API REST
│   └── src/
│       ├── models/      Excursion, Booking, Transfer (zones, lieux, grille), User, Promo, Partner, Settings, Post…
│       ├── services/    booking (recalcul serveur, disponibilités), notify (e-mail + WhatsApp), voucher (PDF), settings (taux)
│       ├── routes/      public.js, admin.js, seo.js (sitemap, robots, 301)
│       ├── jobs.js      rappel J-1, demande d'avis, mise à jour des taux
│       └── seed.js      données de départ
└── client/          Site public + back-office (/admin)
    └── src/
        ├── pages/       Accueil, catalogue, fiche + calculateur, transferts, panier, réservation, espace client, contact, FAQ, blog
        ├── admin/       Tableau de bord, réservations, planning, excursions (5 langues, tarifs, SEO), transferts, promos…
        └── i18n.js      5 langues, URL traduites (/fr/transferts, /de/ausfluege…)
```

## Démarrer en local

Prérequis : Node.js 20+, MongoDB 7 (local ou MongoDB Atlas).

```bash
npm install
cp server/.env.example server/.env      # puis remplir les valeurs
npm run dev                             # API http://localhost:4000 · site http://localhost:5173
```

Au démarrage, le serveur :
- crée **automatiquement le compte administrateur** (`ADMIN_EMAIL` / `ADMIN_PASSWORD` du `.env`) s'il n'existe pas ;
- remplit la base si elle est vide (3 excursions, transferts, FAQ… dans les 5 langues) ;
- complète les traductions manquantes des données de démarrage, sans rien écraser.

`npm run seed` reste disponible (`npm run seed -- --reset` vide la base puis la remplit).

- Site : http://localhost:5173 (redirige vers la langue du navigateur)
- Back-office : http://localhost:5173/admin — par défaut `admin@example.com` / `ChangeMoi123!`
- Mot de passe oublié : mettre `ADMIN_RESET=true` dans `server/.env`, redémarrer, se connecter, puis remettre `false`.
- Le serveur doit afficher `[db] connecté à la base tunisia-tours` : sinon MongoDB n'est pas démarré ou `MONGODB_URI` est faux.

### Traductions
- **Saisie en français uniquement** : à l’enregistrement d’une excursion, d’un trajet, d’un véhicule, d’un lieu, d’une zone, d’un article ou de la FAQ, l’anglais, l’allemand, l’italien et l’espagnol sont remplis automatiquement.
  Si le français est modifié, les autres langues sont retraduites, sauf celles marquées « Relu » ou corrigées à la main.
- Service : DeepL si `DEEPL_API_KEY` est renseigné (recommandé), sinon MyMemory (gratuit, quota limité).
- Interface : `client/src/i18n.js` — les 5 langues sont complètes ; `npm test -w client` échoue si une clé manque dans une langue.
- Contenu (excursions, FAQ, mentions, lieux, véhicules) : stocké en base dans les 5 langues, modifiable dans l'admin.
  Une excursion n'apparaît dans une langue que si cette langue est cochée dans « Langues publiées ».
- Les traductions allemandes, italiennes et espagnoles sont à faire relire par un locuteur natif.
- Le back-office reste en français.
- Tests : `npm test` (moteur de prix) et `npm test -w client` (rendu des pages)

## Production

```bash
docker compose up -d
docker compose exec app npm run seed
```
L'API sert le site compilé sur le port 4000. Placer un reverse proxy HTTPS (Caddy, Nginx) devant.

## Identité visuelle

Logo JS Travel Tunisia dans `client/public/brand/` (emblème clair, emblème blanc pour fonds sombres, logo complet, favicons, image de partage). Couleurs du logo : bleu marine `#14213D`, or `#C9A227`, crème `#F6F1E7`. Typographies : Cormorant Garamond (titres) et Jost (texte). Pour une version vectorielle (SVG) du logo, la fournir et remplacer `emblem.png`.

## Photos

13 photos libres de droits (licence Unsplash, usage commercial autorisé) de lieux tunisiens vérifiés : Sidi Bou Saïd, Carthage, Ksar Ghilane, Djerba, El Jem, Sousse, Mahdia, Tataouine. Liste, crédits et emplacements : **IMAGES.md**.
Elles sont servies en tailles adaptées à chaque écran (640 à 2400 px, WebP/AVIF automatique). Pour les héberger sur votre serveur : `node scripts/download-images.mjs` puis `VITE_LOCAL_IMAGES=1 npm run build`.

## Ce qui est couvert

| Cahier des charges | Où |
|---|---|
| §3 Calculateur (5 modes, minimum garanti, seuil, saisons, enfants/bébés, zones, langue du guide, options par personne/véhicule/réservation, remises, devises) | `shared/pricing.js`, `PriceCalculator.jsx` |
| §3.5 Prix recalculé côté serveur et figé dans la réservation | `services/booking.js` → `createBooking` |
| §3.6 Admin : M et p par saison, seuil calculé, alerte minimum inatteignable, simulateur, historique des prix | `admin/Excursions.jsx` (onglet Tarifs) |
| §4 Transferts : lieux + saisie semi-automatique, grille par zones et véhicule, choix du véhicule selon passagers/bagages, nuit, siège enfant, panneau, aller-retour, délai minimum, vente croisée | `TransferForm.jsx`, `Transfers.jsx`, `admin/Transfers.jsx` |
| §5 Panier commun excursions + transferts, réservation sans paiement, confirmation, bon PDF, .ics, espace client (voir, modifier, annuler), liste d'attente, blocage des absents | `Cart.jsx`, `Checkout.jsx`, `BookingView.jsx` |
| §5.4 Disponibilités : capacité par jour, jours fermés, dates bloquées, confirmation instantanée ou sur demande | modèle `Excursion.availability`, calendrier de la fiche |
| §6 5 langues, URL traduites, hreflang, détection + mémorisation, devises EUR/GBP/TND (taux quotidien ou manuel), écran de traduction côte à côte, pré-traduction DeepL, statut « relu » | `i18n.js`, `admin/Excursions.jsx` |
| §7 Admin : tableau de bord + alertes, réservations (statuts, montant encaissé, actions groupées, filtres enregistrés, export CSV), planning jour/semaine avec glisser-déposer des chauffeurs, rôles, 2FA, journal des actions, recherche globale | `admin/*`, `routes/admin.js` |
| §7.3 Notifications : équipe (e-mail + WhatsApp), client (confirmation, rappel J-1, chauffeur, annulation, avis), feuille de route chauffeur | `services/notify.js`, `jobs.js` |
| §8 SEO : onglet SEO par langue, compteurs, aperçu Google, score, publication bloquée si incomplet, mot-clé unique, 301 automatiques, sitemap avec hreflang, données structurées (TouristTrip/Product, FAQPage, BreadcrumbList, LocalBusiness) | `shared/seo.js`, `routes/seo.js`, `components/ui.jsx` (`Seo`) |
| Cookies Consent Mode v2 + GTM, WhatsApp flottant, retour en haut, anti-spam (champ piège + Cloudflare Turnstile) | `Layout.jsx`, `middleware.js` |

## Points à compléter avant la mise en ligne

1. **Référencement / Core Web Vitals.** Le site est une application React rendue dans le navigateur. Google l'indexe, mais pour viser un référencement solide dans 5 langues et des Core Web Vitals au vert, il faut ajouter un **pré-rendu** des pages publiques (ex. `vite-plugin-ssr`/Vike) ou migrer le site public vers **Next.js**. Les composants et l'API sont réutilisables tels quels.
2. **WhatsApp.** L'API WhatsApp Cloud n'autorise les messages texte libres que dans les 24 h suivant un message du client. Pour les confirmations et rappels, il faut créer et faire valider des **modèles de messages** dans Meta Business, puis adapter `sendWhatsApp` (type `template`).
3. **Widget d'avis Tripadvisor + Google** : coller le script du prestataire choisi dans l'emplacement `#reviews-widget` (accueil).
4. **Google Search Console** (clics et position dans le tableau SEO) et **Google Places** (adresses libres + distance pour le prix au km) : non branchés ; le moteur de prix gère déjà le calcul au km si la distance est fournie.
5. **Traductions** : l'interface est complète en FR et EN ; DE, IT, ES couvrent les éléments principaux et retombent sur l'anglais ailleurs. Les contenus d'exemple n'existent qu'en FR/EN.
6. **Prix d'exemple** : seuls ceux de Carthage viennent du cahier des charges ; tous les autres (excursions, grille de transferts) sont à remplacer dans le back-office.
7. **Compte client** : l'espace client fonctionne par lien sécurisé envoyé par e-mail (sans mot de passe). Un compte avec mot de passe est à ajouter si souhaité.
8. **Stockage des photos** : sur le disque du serveur (`server/uploads`). Pour plusieurs serveurs, passer à S3 ou Cloudinary.
9. **Non développés** : réservation de la « mise à disposition à l'heure » (tarifs saisis, parcours absent), suivi de vol en direct, formation et vidéo.

Démarrage, création de l'admin, connexion au back-office et pages publiques dans les 5 langues vérifiés contre une base compatible MongoDB (FerretDB). Faire un passage complet (réservation, e-mails) sur votre MongoDB avant la mise en production.
