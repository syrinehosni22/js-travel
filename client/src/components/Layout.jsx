import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context.jsx';
import { LANGS, PATHS, path, langName } from '../i18n.js';
import { Icon, Logo, BRAND } from './ui.jsx';
import { PHOTOS } from '../images.js';
import { waLink } from '../whatsapp.js';

function Header() {
  const { t } = useTranslation();
  const { lang, currency, setCurrency, cart } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);

  /** Change de langue en traduisant les segments connus de l'URL */
  function switchLang(next) {
    const parts = loc.pathname.split('/').filter(Boolean);
    const from = PATHS[parts[0]] || PATHS.en;
    const key = Object.keys(from).find((k) => from[k] === parts[1]);
    // La fiche excursion sait retrouver le bon slug traduit (voir ExcursionDetail)
    const rest = parts.slice(2).join('/');
    nav(key ? path(next, key, rest) : `/${next}`);
  }

  const links = [['', 'home'], ['excursions', 'excursions'], ['transfers', 'transfers'], ['custom', 'custom'], ['blog', 'blog'], ['faq', 'faq'], ['contact', 'contact']];
  return (
    <header className="header">
      <div className="container header__inner">
        <Link to={`/${lang}`} className="logo" aria-label="JS Travel Tunisia"><Logo /></Link>
        <nav className={`nav${open ? ' is-open' : ''}`} id="nav" aria-label={t('nav.menu')}>
          <ul>
            {links.map(([key, label]) => (
              <li key={label}><NavLink end={!key} to={key ? path(lang, key) : `/${lang}`}>{t(`nav.${label}`)}</NavLink></li>
            ))}
            <li className="nav__prefs">
              <label>{t('common.language')}
                <select className="lang-select" value={lang} onChange={(e) => switchLang(e.target.value)}>
                  {LANGS.map((l) => <option key={l} value={l}>{langName(l, l)}</option>)}
                </select>
              </label>
              <label>{t('common.currency')}
                <select className="lang-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="EUR">€ EUR</option><option value="GBP">£ GBP</option><option value="TND">DT TND</option>
                </select>
              </label>
            </li>
          </ul>
        </nav>
        <div className="header__actions">
          <label className="visually-hidden desk-only" htmlFor="lang">{t('common.language')}</label>
          <select id="lang" className="lang-select desk-only" value={lang} onChange={(e) => switchLang(e.target.value)}>
            {LANGS.map((l) => <option key={l} value={l} title={langName(l, l)}>{l.toUpperCase()}</option>)}
          </select>
          <label className="visually-hidden" htmlFor="cur">{t('common.currency')}</label>
          <select id="cur" className="lang-select desk-only" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="EUR">€ EUR</option><option value="GBP">£ GBP</option><option value="TND">DT TND</option>
          </select>
          <Link to={path(lang, 'cart')} className="lang-select" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'inherit' }} aria-label={`${t('nav.cart')} (${cart.length})`}>
            <Icon name="bag" /> {cart.length > 0 && <span className="tag">{cart.length}</span>}
          </Link>
          <button className="menu-toggle" aria-controls="nav" aria-expanded={open} aria-label={open ? t('nav.closeMenu') : t('nav.menu')} onClick={() => setOpen(!open)}>
            <Icon name={open ? 'x' : 'menu'} />
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useTranslation();
  const { lang, settings } = useApp();
  const c = settings?.contact || {};
  const s = settings?.social || {};
  const wa = waLink(c.whatsapp, t('hero.waText'));
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__cta">
          <strong>{t('footer.question')}</strong>
          <div>
            {wa && <a href={wa} className="btn btn--whatsapp" target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            <Link to={path(lang, 'contact')} className="btn btn--ghost">{t('footer.write')}</Link>
          </div>
        </div>
        <div className="footer__cols">
          <div><Link to={`/${lang}`} className="logo logo--light" aria-label="JS Travel Tunisia"><Logo light /></Link><br />{c.address}<br />{c.phone}<br />{c.email}</div>
          <div><h3>{t('footer.destinations')}</h3><ul>
            {['desert', 'culture', 'sea', 'family'].map((k) => <li key={k}><Link to={`${path(lang, 'excursions')}?category=${k}`}>{t(`cat.${k}`)}</Link></li>)}
          </ul></div>
          <div><h3>{t('footer.info')}</h3><ul>
            <li><Link to={path(lang, 'legal', 'cancellation')}>{t('footer.cancellation')}</Link></li>
            <li><Link to={path(lang, 'legal', 'terms')}>{t('footer.terms')}</Link></li>
            <li><Link to={path(lang, 'legal', 'privacy')}>{t('footer.privacy')}</Link></li>
          </ul></div>
          <div><h3>{t('footer.follow')}</h3><ul>
            {[['tripadvisor', 'Tripadvisor'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tiktok', 'TikTok']].map(([k, n]) => s[k] ? <li key={k}><a href={s[k]} target="_blank" rel="noopener noreferrer">{n}</a></li> : null)}
          </ul></div>
        </div>
        <div className="footer__bottom">
          © {new Date().getFullYear()} {BRAND}
          <details className="credits"><summary>{t('common.photos')} : Unsplash</summary>
            {Object.values(PHOTOS).map((p) => <span key={p.id}><a href={p.page} target="_blank" rel="noopener noreferrer">{p.place} — {p.by}</a> · </span>)}
          </details>
        </div>
      </div>
    </footer>
  );
}

/** Bannière cookies conforme Consent Mode v2 : GTM ne mesure qu'après accord */
function CookieBanner() {
  const { t } = useTranslation();
  const [choice, setChoice] = useState(() => { try { return localStorage.getItem('consent'); } catch { return null; } });
  useEffect(() => { if (choice === 'granted') grant(); }, []); // eslint-disable-line
  function grant() {
    window.gtag?.('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' });
    const id = import.meta.env.VITE_GTM_ID;
    if (id && !document.getElementById('gtm')) {
      const s = document.createElement('script');
      s.id = 'gtm'; s.async = true; s.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      document.head.appendChild(s);
    }
  }
  const decide = (v) => { try { localStorage.setItem('consent', v); } catch {} setChoice(v); if (v === 'granted') grant(); };
  if (choice) return null;
  return (
    <div className="cookie" role="dialog" aria-label={t('common.cookies')}>
      <p>{t('cookies.text')}</p>
      <button className="btn btn--outline" onClick={() => decide('denied')}>{t('cookies.refuse')}</button>
      <button className="btn btn--green" onClick={() => decide('granted')}>{t('cookies.accept')}</button>
    </div>
  );
}

export default function Layout({ children }) {
  const { t } = useTranslation();
  const { settings } = useApp();
  const [showTop, setShowTop] = useState(false);
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    const on = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const wa = waLink(settings?.contact?.whatsapp, t('hero.waText'));
  return (
    <>
      <a className="visually-hidden" href="#main">{t('common.skip')}</a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      {wa && <a href={wa} className="fab fab--whatsapp" aria-label="WhatsApp" target="_blank" rel="noopener noreferrer"><Icon name="chat" color="#0B3D1F" size={26} /></a>}
      <button className={`fab fab--top${showTop ? ' is-visible' : ''}`} aria-label={t('footer.top')} onClick={() => window.scrollTo({ top: 0 })}><Icon name="up" /></button>
      <CookieBanner />
    </>
  );
}