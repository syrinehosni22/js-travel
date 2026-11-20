import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context.jsx';
import { path } from '../i18n.js';

const words = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
const STOP = new Set(['excursion', 'excursions', 'tour', 'tours', 'circuit', 'circuits', 'trip', 'jour', 'jours', 'day', 'days', 'prive', 'private', 'tunisie', 'tunisia', 'tunesien', 'tunez', 'the', 'les', 'des', 'pour', 'from', 'depuis', 'avec', 'and']);
// Mots qui désignent un transfert : le lien mène à la page Transferts
const TRANSFER = /\b(transferts?|transfers?|aeroport|airport|flughafen|aeroporto|aeropuerto|traslados?|trasferiment[oi]|navette|shuttle)\b/;

/** Excursion dont le titre partage le plus de mots avec le mot-clé (sinon : le catalogue) */
function bestMatch(keyword, tours) {
  const kw = words(keyword).filter((w) => !STOP.has(w));
  let best = null; let score = 0;
  for (const e of tours || []) {
    const tw = new Set(words(`${e.title} ${e.summary || ''}`));
    const s = kw.filter((w) => tw.has(w)).length;
    if (s > score) { best = e; score = s; }
  }
  return best;
}

/**
 * « Recherches populaires » : les mots-clés du site (Admin → Paramètres) affichés en texte visible,
 * chacun lié à l'excursion correspondante. Google lit ce texte et ces liens internes.
 */
export default function PopularSearches({ tours }) {
  const { t } = useTranslation();
  const { lang, settings } = useApp();
  const kws = settings?.siteKeywords || [];
  if (!kws.length) return null;
  return (
    <section className="section popular-searches" aria-labelledby="popular-searches-title">
      <div className="container">
        <h2 id="popular-searches-title" className="section__title" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>{t('home.popularSearches')}</h2>
        <ul className="popular-searches__list">
          {kws.map((k) => {
            const isTransfer = TRANSFER.test(words(k).join(' '));
            const e = isTransfer ? null : bestMatch(k, Array.isArray(tours) ? tours : []);
            const to = isTransfer ? path(lang, 'transfers') : e ? path(lang, 'excursions', e.slug) : path(lang, 'excursions');
            return <li key={k}><Link to={to}>{k}</Link></li>;
          })}
        </ul>
      </div>
    </section>
  );
}
