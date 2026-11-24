import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { ErrorBox, Icon } from './ui.jsx';
import { Stars, StarPicker, fmtDate } from './Reviews.jsx';

/** Ouvre la fenêtre « Votre avis » depuis n'importe quelle page (bouton flottant, accueil) */
export const openSiteReview = () => window.dispatchEvent(new Event('open-site-review'));

/** Fenêtre de saisie d'un avis sur le site et l'expérience (modéré dans Admin → Avis clients) */
export function SiteReviewDialog() {
  const { t } = useTranslation();
  const { lang } = useApp();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ rating: 0, name: '', email: '', comment: '', website: '' });
  const [st, setSt] = useState({});
  const first = useRef(null);
  useEffect(() => {
    const on = () => { setOpen(true); setSt({}); };
    window.addEventListener('open-site-review', on);
    return () => window.removeEventListener('open-site-review', on);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', key);
    setTimeout(() => first.current?.focus(), 0);
    return () => document.removeEventListener('keydown', key);
  }, [open]);
  if (!open) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(ev) {
    ev.preventDefault();
    if (!f.rating || f.name.trim().length < 2) return setSt({ needRating: !f.rating, tried: true });
    setSt({ sending: true });
    try { await api.post('/reviews', { ...f, lang }); setSt({ sent: true }); setF({ rating: 0, name: '', email: '', comment: '', website: '' }); }
    catch (error) { setSt({ error }); }
  }
  return (
    <div className="modal" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="modal__box" role="dialog" aria-modal="true" aria-labelledby="site-review-title">
        <button type="button" className="modal__close" aria-label={t('rev.close')} onClick={() => setOpen(false)}><Icon name="x" /></button>
        <h2 id="site-review-title" style={{ marginTop: 0 }}>{t('rev.siteTitle')}</h2>
        {st.sent ? <p className="alert alert--ok" role="status">{t('rev.sent')}</p> : (
          <form className={`reviews__form${st.tried ? ' was-validated' : ''}`} onSubmit={submit} noValidate>
            <p className="muted full" style={{ margin: 0 }}>{t('rev.siteIntro')}</p>
            <p className="muted full form-legend">{t('common.requiredLegend')}</p>
            <div className="field full"><span>{t('rev.yourRating')} *</span><StarPicker value={f.rating} onChange={(n) => setF({ ...f, rating: n })} />
              {st.needRating && <small className="reviews__err" role="alert">{t('rev.ratingRequired')}</small>}
            </div>
            <label className="field">{t('rev.name')} *<input ref={first} required minLength={2} maxLength={60} value={f.name} onChange={set('name')} autoComplete="given-name" /></label>
            <label className="field">{t('rev.email')}<input type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
            <label className="field full">{t('rev.comment')}<textarea rows={4} maxLength={2000} placeholder={t('rev.sitePh')} value={f.comment} onChange={set('comment')} /></label>
            <input className="hp" tabIndex={-1} aria-hidden="true" autoComplete="off" value={f.website} onChange={set('website')} name="website" />
            {st.error && <div className="full"><ErrorBox error={st.error} /></div>}
            <button className="btn btn--primary full" disabled={st.sending}>{st.sending ? t('rev.sending') : t('rev.submit')}</button>
          </form>
        )}
      </div>
    </div>
  );
}

/** Avis publiés sur le site (section de l'accueil) */
export function useSiteReviews() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/reviews').then(setData).catch(() => setData({ list: [], rating: { count: 0 } })); }, []);
  return data;
}

const FIRST = 6;   // avis affichés avant « Voir tous les avis »

export function SiteReviewList({ list }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const [all, setAll] = useState(false);
  const top = useRef(null);
  if (!list?.length) return null;
  const more = list.length > FIRST;
  function toggle() {
    // En refermant, on revient au début de la liste pour ne pas perdre le visiteur
    if (all) top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setAll(!all);
  }
  return (
    <>
    <div className="review-grid" ref={top} id="site-reviews">
      {(all ? list : list.slice(0, FIRST)).map((r) => (
        <blockquote key={r.id} className="review">
          <Stars value={r.rating} size={16} label={t('rev.star', { count: r.rating })} />
          {r.comment && <p>{r.comment}</p>}
          {r.reply && <p style={{ opacity: 0.8, fontSize: 14 }}><b>{t('rev.reply')}</b> — {r.reply}</p>}
          <footer><span><cite>{r.name}</cite><span>{fmtDate(r.createdAt, lang)}</span></span></footer>
        </blockquote>
      ))}
    </div>
    {more && (
      <div className="review-more">
        <button type="button" className="btn btn--gold-outline" aria-expanded={all} aria-controls="site-reviews" onClick={toggle}>
          {all ? t('rev.showLess') : t('rev.showAll', { n: list.length })}
        </button>
      </div>
    )}
    </>
  );
}
