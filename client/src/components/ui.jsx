import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context.jsx';
import { LANGS, path, placeName } from '../i18n.js';
import { PHOTOS, photoUrl, srcSet, keyFromUrl, photoAlt } from '../images.js';
import { assetUrl } from '../api.js';

export const BRAND = 'JS Travel Tunisia';

/** Logo : emblème (image extraite du logo fourni) + nom en Cormorant Garamond, « TUNISIA » en Jost doré */
export function Logo({ light, size }) {
  return (
    <>
      <img src={light ? '/brand/emblem-white.png' : '/brand/emblem.png'} alt="" width={size || 48} height={size || 48} />
      <span className="logo__text"><span className="logo__name">JS Travel</span><span className="logo__tag">TUNISIA</span></span>
    </>
  );
}

const ICONS = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  bag: <><path d="M5 7h14l-1.5 13h-11z" /><path d="M9 7a3 3 0 0 1 6 0" /></>,
  chat: <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z" />,
  up: <path d="M6 15l6-6 6 6" />,
  left: <path d="M15 18l-6-6 6-6" />,
  right: <path d="M9 18l6-6-6-6" />,
  pin: <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  check: <path d="M5 12l5 5L20 7" />,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 15h2" /></>,
  guide: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></>,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
};
export function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 2 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>;
}

/**
 * Image responsive avec couleur de repli pendant le chargement.
 * `photo` = clé de la photothèque (images.js) ; sinon `src` = URL.
 * `sizes` indique la largeur affichée pour que le navigateur choisisse la bonne taille.
 */
export function Media({ photo, src, alt, ph, className = '', style, children, eager, sizes = '(max-width: 640px) 100vw, 50vw' }) {
  const { lang } = useApp() || {};
  // Photo de la photothèque (par clé ou par URL Unsplash enregistrée en base) → tailles responsives
  const key = (photo && PHOTOS[photo] ? photo : null) || keyFromUrl(src);
  const url = key ? photoUrl(key, 1600) : assetUrl(src);
  const set = url ? srcSet(key || url) : undefined;
  return (
    <div className={`media ${className}`} style={{ '--ph': ph || PHOTOS[key]?.ph || '#DDE6E2', ...style }}>
      {url && <img src={url} srcSet={set} sizes={set ? sizes : undefined} alt={alt ?? (key ? photoAlt(key, lang) : '')}
        loading={eager ? 'eager' : 'lazy'} fetchpriority={eager ? 'high' : undefined} decoding="async" onError={(e) => e.currentTarget.remove()} />}
      {children}
    </div>
  );
}

/**
 * Balises SEO : title, description, canonical, hreflang des 5 langues, Open Graph, données structurées (§8).
 * `alternates` = { en: '/en/...', fr: '/fr/...' } ; à défaut, la même URL dans chaque langue.
 */
export function Seo({ title, description, canonical, alternates, image, noindex, jsonLd }) {
  const { lang } = useApp();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = canonical || (typeof window !== 'undefined' ? window.location.pathname : '');
  return (
    <Helmet>
      <html lang={lang} />
      {title && <title>{title.includes('JS Travel') ? title : `${title} | JS Travel Tunisia`}</title>}
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={origin + url} />
      {alternates && LANGS.filter((l) => alternates[l]).map((l) => <link key={l} rel="alternate" hrefLang={l} href={origin + alternates[l]} />)}
      {alternates?.en && <link rel="alternate" hrefLang="x-default" href={origin + alternates.en} />}
      {noindex && <meta name="robots" content="noindex" />}
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:image" content={(() => { const i = assetUrl(image || '/brand/og-default.jpg'); return i.startsWith('http') ? i : origin + i; })()} />
      <meta property="og:type" content="website" />
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}

/** Prix « à partir de » des cartes : prix réduit + nombre de personnes (§3.5) */
export function FromPrice({ from }) {
  const { t } = useTranslation();
  const { money } = useApp();
  if (!from || from.quote || from.amount == null) return <div className="price">{t('price.quote')}</div>;
  const unit = from.per === 'vehicle' ? t('price.perVehicle') : from.per === 'group' ? t('price.perGroup') : t('price.perPerson');
  return <div className="price">{money(from.amount)}<small> {unit} {t('price.ttc')}{from.from > 1 ? ` · ${t('price.from', { n: from.from })}` : ''}</small></div>;
}

const PH = { culture: '#C7D8EA', desert: '#EAD3B2', sea: '#BFE0DD', adventure: '#D7D9B8', family: '#E3C9AE' };
export function TourCard({ e }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const href = path(lang, 'excursions', e.slug);
  return (
    <article className="tour">
      <Media src={e.image?.url} alt={e.image?.alt} ph={PH[e.category]} style={{ height: 230 }} sizes="(max-width: 700px) 100vw, 400px">
        {e.badges?.[0] && <span className="badge">{t(`badge.${e.badges.includes('bestseller') ? 'bestseller' : e.badges[0]}`)}</span>}
      </Media>
      <div className="tour__body">
        <div className="tour__meta">
          {e.durationLabel && <span>{e.durationLabel}</span>}
          {e.rating?.value && <span>★ {e.rating.value} ({e.rating.count})</span>}
          {e.category && <span>{t(`cat.${e.category}`)}</span>}
        </div>
        <h3 className="tour__title"><Link to={href}>{e.title}</Link></h3>
        {e.departureCities?.length > 0 && <p className="tour__from">{e.departureCities.map((c) => placeName(c, lang)).join(', ')}</p>}
        <div className="tour__foot">
          <FromPrice from={e.from} />
          <Link to={href} className="btn btn--primary">{t('nav.book')}</Link>
        </div>
      </div>
    </article>
  );
}

export function Loading() {
  const { t } = useTranslation();
  return <div className="spinner" role="status">{t('common.loading')}</div>;
}
export function ErrorBox({ error }) {
  const { t } = useTranslation();
  // Les erreurs de l'API arrivent sous forme de code (ex. TOO_LATE) : on les traduit dans la langue du site
  const code = error?.body?.error || (error?.status === 429 ? 'TOO_MANY' : null);
  const params = error?.body?.details || {};
  const msg = code && t(`errors.${code}`, { ...params, defaultValue: '' });
  return <div className="alert alert--error" role="alert">{msg || t('common.error')}</div>;
}

/** Compteur +/− accessible */
export function Counter({ label, hint, value, min = 0, max = 99, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="counter">
      <div><strong>{label}</strong>{hint && <small>{hint}</small>}</div>
      <div className="counter__ctrl">
        <button type="button" aria-label={`${t('calc.remove')} — ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <output aria-live="polite">{value}</output>
        <button type="button" aria-label={`${t('calc.add1')} — ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

/** Détail ligne par ligne d'un prix calculé */
export function PriceLines({ lines = [] }) {
  const { t } = useTranslation();
  const { money } = useApp();
  const label = (l) => {
    if (['adult', 'child', 'infant'].includes(l.key)) return `${l.qty} ${t(`price.${l.key}`)} × ${money(l.unit)}`;
    if (l.key === 'minimum') return t('price.minimum', { n: l.qty });
    if (l.key === 'option') return `${l.label}${l.qty > 1 ? ` × ${l.qty}` : ''}`;
    if (l.key === 'zone') return `${t('price.zone')} (${l.label})`;
    if (l.key === 'discount') return `${t('price.discount')} −${Math.round(l.rate * 100)} %`;
    if (l.key === 'vehicle') return `${l.qty} ${t('price.vehicle')} × ${money(l.unit)}`;
    return t(`price.${l.key}`);
  };
  return <div className="lines">{lines.map((l, i) => <div key={i}><span>{label(l)}</span><span>{l.amount < 0 ? '−' : ''}{money(Math.abs(l.amount), 2)}</span></div>)}</div>;
}
