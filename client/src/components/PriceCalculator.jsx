import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { computeExcursionPrice } from '../lib/pricing.js';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { path, langName } from '../i18n.js';
import { Counter, PriceLines, Icon } from './ui.jsx';

/** Calendrier mensuel de disponibilité (§5.4) */
function DatePicker({ excursionId, value, onChange }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const [month, setMonth] = useState(() => (value || new Date().toISOString()).slice(0, 7));
  const [days, setDays] = useState({});
  useEffect(() => { api.get(`/excursions/${excursionId}/availability?month=${month}`).then(setDays).catch(() => setDays({})); }, [excursionId, month]);
  const [y, m] = month.split('-').map(Number);
  const first = (new Date(y, m - 1, 1).getDay() + 6) % 7; // lundi = 0
  const count = new Date(y, m, 0).getDate();
  const shift = (d) => { const x = new Date(y, m - 1 + d, 1); setMonth(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); };
  const fmt = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' });
  const wd = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(lang, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)));
  return (
    <div>
      <div className="cal__nav">
        <button type="button" onClick={() => shift(-1)} aria-label={t('common.prevMonth')}><Icon name="left" /></button>
        <strong>{(() => { const x = fmt.format(new Date(y, m - 1, 1)); return x.charAt(0).toLocaleUpperCase(lang) + x.slice(1); })()}</strong>
        <button type="button" onClick={() => shift(1)} aria-label={t('common.nextMonth')}><Icon name="right" /></button>
      </div>
      <div className="cal" role="grid" aria-label={t('calc.chooseDate')}>
        {wd.map((d, i) => <div key={i} className="cal__head" aria-hidden="true">{d}</div>)}
        {[...Array(first)].map((_, i) => <div key={`e${i}`} />)}
        {[...Array(count)].map((_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          const s = days[date] || 'past';
          return <button type="button" key={date} data-s={s} aria-pressed={value === date} disabled={s !== 'open'} onClick={() => onChange(date)} aria-label={new Intl.DateTimeFormat(lang, { dateStyle: 'full' }).format(new Date(y, m - 1, i + 1))}>{i + 1}</button>;
        })}
      </div>
    </div>
  );
}

/**
 * Encart calculateur de la fiche (§3.5) : prix total et prix par personne mis à jour
 * instantanément avec le moteur partagé ; le serveur recalcule à l'enregistrement.
 */
export default function PriceCalculator({ excursion }) {
  const { t } = useTranslation();
  const { lang, settings, money, addToCart, promoCode } = useApp();
  const nav = useNavigate();
  const pr = excursion.pricing || {};
  const maxGroup = pr.maxGroup || 8;
  const [date, setDate] = useState('');
  const [p, setP] = useState({ adult: 2, child: 0, infant: 0 });
  const [zone, setZone] = useState(pr.zones?.[0]?.key || '');
  const [guideLang, setGuideLang] = useState(excursion.guideLanguages?.includes(lang) ? lang : excursion.guideLanguages?.[0]);
  const [options, setOptions] = useState([]);
  const [promo, setPromo] = useState(null);
  const [avail, setAvail] = useState(null);
  const [wl, setWl] = useState({ open: false, email: '', sent: false });

  // Remise du code promo saisi dans le panier
  useEffect(() => {
    if (!promoCode) return setPromo(null);
    api.post('/promo/check', { code: promoCode, excursion: excursion.id }).then((r) => setPromo(r.valid ? r.rate : null)).catch(() => setPromo(null));
  }, [promoCode, excursion.id]);

  useEffect(() => {
    if (!date) return setAvail(null);
    api.post(`/excursions/${excursion.id}/quote`, { date, participants: p }).then((r) => setAvail(r.availability)).catch(() => setAvail(null));
  }, [date]); // eslint-disable-line

  const booking = { date: date || undefined, participants: p, zone, guideLang, options };
  const price = useMemo(() => computeExcursionPrice(excursion, booking, {
    calendar: settings?.calendar, discount: promo ? { rate: promo, source: 'promo' } : undefined, lang,
  }), [excursion, JSON.stringify(booking), settings, promo, lang]); // eslint-disable-line

  const total = p.adult + p.child + p.infant;
  const toggle = (k) => setOptions((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  const item = { type: 'excursion', excursion: excursion.id, title: excursion.title, slug: excursion.slug, image: excursion.image?.url, date, participants: p, zone, guideLang, options, estimateEur: price.totalEur };
  const canBook = date && avail?.available && !price.quote && !price.error;
  const unit = (o) => t(o.per === 'person' ? 'calc.perPersonOpt' : o.per === 'vehicle' ? 'calc.perVehicleOpt' : 'calc.perBookingOpt');

  const ages = { c: pr.childAges || [4, 11], i: pr.infantAges || [0, 3] };
  const from = excursion.from;
  const fromUnit = from?.per === 'vehicle' ? t('price.perVehicle') : from?.per === 'group' ? t('price.perGroup') : t('price.perPerson');
  return (
    <>
      <section className="card calc" aria-label={t('calc.title')}>
        <div className="calc__from">
          {from?.amount != null && !from.quote
            ? <><small>{t('detail.from')}</small><div><strong>{money(from.amount)}</strong> <span>{fromUnit} {t('price.ttc')}</span></div>{from.from > 1 && <small>{t('price.from', { n: from.from })}</small>}</>
            : <strong>{t('price.quote')}</strong>}
        </div>

        <div className="calc__people">
          <span className="calc__label"><Icon name="users" size={16} /> {t('search.people')}</span>
          <Counter label={t('calc.adults')} hint={t('calc.adultsHint')} value={p.adult} min={1} max={maxGroup} onChange={(v) => setP({ ...p, adult: v })} />
          <Counter label={t('calc.children')} hint={(pr.childDiscount ?? 0) > 0 ? t('calc.childrenHint', { from: ages.c[0], to: ages.c[1], pct: Math.round(pr.childDiscount * 100) }) : t('calc.infantsHint', { from: ages.c[0], to: ages.c[1] })} value={p.child} max={maxGroup} onChange={(v) => setP({ ...p, child: v })} />
          <Counter label={t('calc.infants')} hint={t('calc.infantsHint', { from: ages.i[0], to: ages.i[1] })} value={p.infant} max={maxGroup} onChange={(v) => setP({ ...p, infant: v })} />
        </div>

        <div className="field calc__field" style={{ flex: 'none' }}><span className="calc__label"><Icon name="calendar" size={16} /> {t('calc.date')}</span>
          <DatePicker excursionId={excursion.id} value={date} onChange={setDate} />
        </div>

        {price.overCapacity && <div className="alert alert--info">{t('calc.overCapacity', { n: maxGroup })} — <Link to={path(lang, 'custom')}>{t('calc.quote')}</Link></div>}
        {!price.quote && price.belowThreshold && <div className="alert alert--warn">{t('price.missing', { count: price.missing, price: money(price.unitReducedPrice) })}</div>}
        {!price.quote && !price.belowThreshold && pr.mode === 'minimum' && total > 0 && <div className="alert alert--ok">{t('price.reached', { price: money(price.unitReducedPrice) })}</div>}

        {pr.zones?.length > 0 && (
          <label className="field" style={{ flex: 'none' }}>{t('calc.pickup')}
            <select value={zone} onChange={(e) => setZone(e.target.value)}>
              {pr.zones.map((z) => <option key={z.key} value={z.key}>{z.label || z.key}{z.fee ? ` (+${money(z.fee)})` : ''}</option>)}
            </select>
          </label>
        )}
        {excursion.guideLanguages?.length > 1 && (
          <label className="field" style={{ flex: 'none' }}>{t('calc.guideLang')}
            <select value={guideLang} onChange={(e) => setGuideLang(e.target.value)}>
              {excursion.guideLanguages.map((l) => { const fee = pr.guideLanguages?.find((g) => g.lang === l)?.fee; return <option key={l} value={l}>{langName(l, lang)}{fee ? ` (+${money(fee)})` : ''}</option>; })}
            </select>
          </label>
        )}
        {pr.options?.length > 0 && (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field" style={{ padding: 0, marginBottom: 8 }}>{t('calc.options')}</legend>
            <div className="extras-list">
              {pr.options.map((o) => (
                <label key={o.key} className={`extra${options.includes(o.key) ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={options.includes(o.key)} onChange={() => toggle(o.key)} />
                  <span className="extra__name">{o.label}{o.description && <small>{o.description}</small>}</span>
                  <span className="extra__price">+{money(o.price)} <small>{unit(o)}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {!price.quote && (
          <div className="calc__total">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>{t('price.total')} <small className="muted">({total} pers.)</small></span>
              <strong>{money(price.totalEur, 2)}<small className="ttc"> {t('price.ttc')}</small></strong>
            </div>
            {price.payers > 0 && <small className="muted">{money(price.perPerson, 2)} {t('price.perPerson')} {t('price.ttc')}</small>}
            <details>
              <summary>{t('price.details')}</summary>
              <PriceLines lines={price.lines} />
            </details>
          </div>
        )}

        {date && avail && !avail.available && (
          <div className="alert alert--warn">
            {t(avail.reason === 'FULL' ? 'calc.full' : avail.reason === 'TOO_LATE' ? 'calc.tooLate' : 'calc.closed')}
            {avail.waitlist && !wl.sent && <> <button className="link-btn" onClick={() => setWl({ ...wl, open: true })}>{t('calc.waitlist')}</button></>}
            {wl.open && !wl.sent && (
              <form className="row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); api.post('/waitlist', { excursion: excursion.id, date, email: wl.email, participants: total, lang }).then(() => setWl({ ...wl, sent: true })); }}>
                <input type="email" required placeholder={t('common.yourEmail')} aria-label={t('common.yourEmail')} value={wl.email} onChange={(e) => setWl({ ...wl, email: e.target.value })} style={{ height: 44, flex: 1, border: '1px solid var(--field)', borderRadius: 10, padding: '0 10px' }} />
                <button className="btn btn--green">{t('common.ok')}</button>
              </form>
            )}
            {wl.sent && ' ✓'}
          </div>
        )}
        {date && avail?.available && <div className="muted" style={{ fontSize: 14 }}>{avail.mode === 'instant' ? t('calc.instant') : t('calc.onRequest')}</div>}

        {price.quote
          ? <Link to={path(lang, 'custom')} className="btn btn--green btn--lg">{t('calc.quote')}</Link>
          : (
            <div className="stack" style={{ gap: 10 }}>
              <button className="btn btn--primary btn--lg" disabled={!canBook} onClick={() => { addToCart(item); nav(path(lang, 'checkout')); }}>{date ? t('calc.book') : t('calc.chooseDate')}</button>
              <button className="btn btn--outline" disabled={!canBook} onClick={() => { addToCart(item); nav(path(lang, 'cart')); }}>{t('calc.add')}</button>
            </div>
          )}
        <ul className="calc__trust">
          <li><Icon name="check" size={16} /> {t('detail.freeCancelText', { h: excursion.cancellationFreeHours || 24 })}</li>
          <li><Icon name="wallet" size={16} /> {t('detail.payLaterText')}</li>
        </ul>
      </section>

      {/* Barre fixe en bas d'écran sur mobile */}
      <div className="mobile-bar">
        {date && !price.quote
          ? <div><small>{t('price.total')} {t('price.ttc')}</small><strong>{money(price.totalEur, 2)}</strong></div>
          : <div><small>{t('detail.from')}</small><strong>{from?.amount != null && !from.quote ? money(from.amount) : t('price.quote')}</strong>{from?.amount != null && !from.quote && <small> {fromUnit} {t('price.ttc')}</small>}</div>}
        <a href="#calculator" className="btn btn--primary">{t('detail.checkAvailability')}</a>
      </div>
    </>
  );
}
