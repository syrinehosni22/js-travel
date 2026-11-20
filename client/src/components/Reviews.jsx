import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { ErrorBox } from './ui.jsx';

const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z';

/** Étoiles en lecture seule, remplies au dixième près (ex. 4,6). */
export function Stars({ value = 0, size = 16, label }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const row = (fill) => (
    <span className="stars-row" style={{ color: fill }}>
      {[0, 1, 2, 3, 4].map((i) => <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} fill="currentColor" /></svg>)}
    </span>
  );
  return (
    <span className="stars-meter" role="img" aria-label={label}>
      {row('var(--line, #d9dde3)')}
      <span className="stars-meter__fill" style={{ width: `${pct}%` }}>{row('var(--gold, #c9a227)')}</span>
    </span>
  );
}

/** Choix de la note : 5 étoiles cliquables, utilisables au clavier (boutons radio). */
export function StarPicker({ value, onChange }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="star-picker" role="radiogroup" aria-label={t('rev.yourRating')} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={n <= shown ? 'on' : ''} onMouseEnter={() => setHover(n)}>
          <input type="radio" name="rating" value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
          <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} fill="currentColor" /></svg>
          <span className="sr-only">{t('rev.star', { count: n })}</span>
        </label>
      ))}
    </div>
  );
}

export const fmtDate = (d, lang) => { try { return new Date(d).toLocaleDateString(lang, { year: 'numeric', month: 'long' }); } catch { return ''; } };

/** Rubrique « Avis clients » de la fiche : note moyenne, liste des avis publiés, formulaire. */
export default function Reviews({ excursionId, rating, lang }) {
  const { t } = useTranslation();
  const [list, setList] = useState(null);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ rating: 0, name: '', email: '', comment: '', website: '' });
  const [st, setSt] = useState({ sending: false, sent: false, error: null, needRating: false });

  useEffect(() => {
    let alive = true;
    api.get(`/excursions/${excursionId}/reviews`).then((r) => alive && setList(Array.isArray(r) ? r : [])).catch(() => alive && setList([]));
    return () => { alive = false; };
  }, [excursionId]);

  async function submit(ev) {
    ev.preventDefault();
    if (!f.rating || f.name.trim().length < 2) return setSt({ ...st, needRating: !f.rating, tried: true });
    setSt({ sending: true });
    try { await api.post(`/excursions/${excursionId}/reviews`, { ...f, lang }); setSt({ sent: true }); }
    catch (error) { setSt({ error }); }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const count = rating?.count || list?.length || 0;
  const avg = rating?.value || (list?.length ? list.reduce((a, r) => a + r.rating, 0) / list.length : 0);
  const shown = all ? list : list?.slice(0, 4);

  return (
    <section className="gyg-sec reviews" id="reviews" aria-labelledby="reviews-title">
      <h2 id="reviews-title">{t('rev.title')}</h2>

      <div className="reviews__head">
        {count > 0 ? (
          <div className="reviews__score">
            <strong>{avg.toFixed(1).replace('.', lang === 'en' ? '.' : ',')}</strong>
            <div><Stars value={avg} size={20} label={`${avg.toFixed(1)} / 5`} /><small>{t('rev.basedOn', { count })}</small></div>
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>{t('rev.none')}</p>}
        {!open && !st.sent && <button type="button" className="btn btn--outline" onClick={() => setOpen(true)}>{t('rev.write')}</button>}
      </div>

      {st.sent && <p className="alert alert--ok" role="status">{t('rev.sent')}</p>}

      {open && !st.sent && (
        <form className={`card reviews__form${st.needRating || st.tried ? ' was-validated' : ''}`} onSubmit={submit} noValidate>
          <p className="muted full form-legend">{t('common.requiredLegend')}</p>
          <div className="field full"><span>{t('rev.yourRating')} *</span><StarPicker value={f.rating} onChange={(n) => setF({ ...f, rating: n })} />
            {st.needRating && <small className="reviews__err" role="alert">{t('rev.ratingRequired')}</small>}
          </div>
          <label className="field">{t('rev.name')} *<input required minLength={2} maxLength={60} value={f.name} onChange={set('name')} autoComplete="given-name" /></label>
          <label className="field">{t('rev.email')}<input type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
          <label className="field full">{t('rev.comment')}<textarea maxLength={2000} rows={4} placeholder={t('rev.commentPh')} value={f.comment} onChange={set('comment')} /></label>
          <input className="hp" tabIndex={-1} aria-hidden="true" autoComplete="off" value={f.website} onChange={set('website')} name="website" />
          {st.error && <div className="full"><ErrorBox error={st.error} /></div>}
          <div className="row full">
            <button className="btn btn--primary" disabled={st.sending}>{st.sending ? t('rev.sending') : t('rev.submit')}</button>
            <button type="button" className="link-btn" onClick={() => setOpen(false)}>{t('rev.cancel')}</button>
          </div>
        </form>
      )}

      {shown?.length > 0 && (
        <ul className="reviews__list">
          {shown.map((r) => (
            <li key={r.id} className="rv-item">
              <div className="rv-item__top">
                <span className="rv-item__avatar" aria-hidden="true">{(r.name || '?').trim().charAt(0).toUpperCase()}</span>
                <div><b>{r.name}</b><small className="muted">{fmtDate(r.createdAt, lang)}</small></div>
                <Stars value={r.rating} size={15} label={t('rev.star', { count: r.rating })} />
              </div>
              {r.comment && <p>{r.comment}</p>}
              {r.reply && <div className="rv-item__reply"><b>{t('rev.reply')}</b><p>{r.reply}</p></div>}
            </li>
          ))}
        </ul>
      )}
      {list?.length > 4 && !all && <button type="button" className="btn btn--outline" onClick={() => setAll(true)}>{t('rev.showAll', { n: list.length })}</button>}
    </section>
  );
}
