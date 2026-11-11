import { Link } from 'react-router-dom';
import { adminApi } from '../api.js';
import { useLoad, Err, LANGS } from './shared.jsx';

/** Libellés des vérifications globales : [si OK, à corriger, lien pour corriger] */
const CHECKS = {
  domain: [() => 'Nom de domaine configuré', (v) => `Le site est en ligne sur une adresse technique (${v}). Un nom de domaine (ex. js-travel.tn) est indispensable pour Google.`],
  https: [() => 'Connexion sécurisée (HTTPS)', () => 'Le site n’est pas en HTTPS : Google le signale « non sécurisé » et le classe moins bien.'],
  homeMeta: [() => 'Titre et description Google de l’accueil remplis', (v) => `Titre ou description Google de l’accueil manquant en ${v.map((l) => l.toUpperCase()).join(', ')}.`, '/admin/settings'],
  excursionsPublished: [(v) => `${v} excursions publiées`, (v) => `Seulement ${v} excursion(s) publiée(s) : publiez-en au moins 3.`, '/admin/excursions'],
  requiredFields: [() => 'Champs SEO obligatoires complets', (v) => `${v} excursion(s) publiée(s) avec des champs SEO obligatoires vides.`, '/admin/seo'],
  imageAlt: [() => 'Photos décrites (texte alternatif)', (v) => `${v} excursion(s) sans photo principale ou sans description de photo.`, '/admin/excursions'],
  duplicateKeywords: [() => 'Mots-clés principaux tous différents', (v) => `Mot-clé utilisé sur plusieurs fiches : ${v.map((x) => `« ${x.value} » (${x.lang.toUpperCase()})`).join(', ')}.`, '/admin/seo'],
  duplicateTitles: [() => 'Titres SEO tous différents', (v) => `Titre SEO identique sur plusieurs fiches : ${v.map((x) => `« ${x.value} »`).join(', ')}.`, '/admin/seo'],
  languages: [() => 'Excursions publiées dans les 5 langues', (v) => `Aucune excursion publiée en ${v.map((l) => l.toUpperCase()).join(', ')}.`, '/admin/excursions'],
  blog: [(v) => `${v} articles de blog publiés`, (v) => `${v} article(s) de blog : publiez des conseils de voyage (au moins 3) pour attirer des visiteurs.`, '/admin/posts'],
  transferPages: [(v) => `${v} page(s) de transfert publiée(s)`, () => 'Aucune page de transfert (ex. « Transfert aéroport Enfidha – Sousse ») : très recherché sur Google.', '/admin/transfers'],
  localBusiness: [() => 'Téléphone et adresse renseignés (fiche entreprise)', () => 'Téléphone ou adresse manquant : Google ne peut pas afficher votre fiche entreprise.', '/admin/settings'],
  reviews: [(v) => `Note des avis affichée (${v}/5)`, () => 'Aucune note d’avis renseignée : les étoiles n’apparaissent pas dans Google.', '/admin/settings'],
};
const MISSING = { title: 'titre', focusKeyword: 'mot-clé principal', metaTitle: 'titre SEO', metaDescription: 'méta description', slug: 'adresse (URL)', h1: 'titre H1', mainImageAlt: 'description de la photo' };
const FAILED = {
  kwInTitle: 'mot-clé absent du titre SEO', kwInSlug: 'mot-clé absent de l’URL', kwInH1: 'mot-clé absent du H1', kwInFirstParagraph: 'mot-clé absent du 1er paragraphe',
  kwInAlt: 'mot-clé absent des photos', titleLength: 'titre SEO : 50 à 60 caractères', descriptionLength: 'méta description : 140 à 160 caractères',
  h1DiffersFromTitle: 'H1 identique au titre SEO', textLength: 'texte trop court (300 mots min.)', internalLinks: 'aucune excursion liée',
};
const COLORS = { green: '#16A34A', orange: '#D97706', red: '#DC2626' };

function Ring({ score, light }) {
  const r = 42; const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" width="112" height="112" role="img" aria-label={`Score SEO global : ${score} sur 100`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#E7E1D3" strokeWidth="10" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={COLORS[light]} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="26" fontWeight="800" fill="currentColor">{score}</text>
    </svg>
  );
}

/** Bilan SEO global (tableau de bord et page SEO) */
export default function SeoSummary({ compact = false }) {
  const { data, error } = useLoad(() => adminApi.get('/seo/summary'));
  if (error) return <Err error={error} />;
  if (!data) return <section className="panel seo-sum"><p className="muted">Analyse du référencement…</p></section>;
  const todo = data.checks.filter((c) => !c.ok);
  const done = data.checks.filter((c) => c.ok);
  const verdict = data.light === 'green' ? 'Bon référencement' : data.light === 'orange' ? 'Référencement à améliorer' : 'Référencement faible';
  return (
    <section className="panel seo-sum" aria-labelledby="seo-sum-title">
      <header className="seo-sum__head">
        <h2 id="seo-sum-title">Référencement du site (SEO)</h2>
        <div className="row">
          <a className="btn btn--outline btn-sm" href="/sitemap.xml" target="_blank" rel="noreferrer">Plan du site ({data.counts.sitemapUrls} pages)</a>
          {compact && <Link className="btn btn--outline btn-sm" to="/admin/seo">Détail par fiche</Link>}
        </div>
      </header>

      <div className="seo-sum__top">
        <div className="seo-sum__score" style={{ color: COLORS[data.light] }}>
          <Ring score={data.score} light={data.light} />
          <div><strong>{verdict}</strong><span className="muted">{done.length}/{data.checks.length} points validés · {data.counts.published} excursion(s) en ligne</span></div>
        </div>
        <div className="seo-sum__langs" aria-label="Qualité des fiches par langue">
          {LANGS.map((l) => {
            const x = data.langs[l];
            const v = x.avgScore ?? 0;
            const light = v >= 80 ? 'green' : v >= 50 ? 'orange' : 'red';
            return (
              <div key={l} className="seo-lang">
                <span className="seo-lang__code">{l.toUpperCase()}</span>
                <span className="seo-lang__bar"><i style={{ width: `${v}%`, background: x.published ? COLORS[light] : 'transparent' }} /></span>
                <span className="seo-lang__val">{x.published ? `${v}` : '—'}</span>
                <small className="muted">{x.published} fiche{x.published > 1 ? 's' : ''}</small>
              </div>
            );
          })}
        </div>
      </div>

      <div className="seo-sum__cols">
        <div>
          <h3>À corriger <span className="tag">{todo.length}</span></h3>
          {todo.length === 0 && <p className="muted">Rien à corriger sur l’ensemble du site.</p>}
          <ul className="seo-checks">
            {todo.map((c) => {
              const [, ko, link] = CHECKS[c.key] || [null, () => c.key];
              return <li key={c.key} className="is-ko"><span>{ko(c.value)}</span>{link && <Link to={link}>Corriger</Link>}</li>;
            })}
          </ul>
          {!compact && done.length > 0 && (
            <details className="seo-done"><summary>Points validés ({done.length})</summary>
              <ul className="seo-checks">{done.map((c) => <li key={c.key} className="is-ok"><span>{(CHECKS[c.key]?.[0] || (() => c.key))(c.value)}</span></li>)}</ul>
            </details>
          )}
        </div>
        <div>
          <h3>Fiches à améliorer <span className="tag">{data.issuesTotal}</span></h3>
          {data.issues.length === 0 && <p className="muted">Toutes les fiches publiées ont un bon score.</p>}
          <ul className="seo-issues">
            {data.issues.map((x) => (
              <li key={`${x.id}-${x.lang}`}>
                <Link to={`/admin/excursions/${x.id}`}><strong>{x.title}</strong> <span className="muted">· {x.lang.toUpperCase()}</span></Link>
                <span className="seo-issues__score" style={{ color: COLORS[x.score >= 80 ? 'green' : x.score >= 50 ? 'orange' : 'red'] }}>{x.score}</span>
                <small>{[...x.missing.map((m) => `${MISSING[m] || m} manquant`), ...x.failed.map((f) => FAILED[f] || f)].slice(0, 3).join(' · ')}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
