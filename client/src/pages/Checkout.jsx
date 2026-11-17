import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { path, placeName } from '../i18n.js';
import { Seo, ErrorBox, PriceLines } from '../components/ui.jsx';
import { countryList } from '../lib/countries.js';
import { CartLine, PromoBox } from './Cart.jsx';

/** Recalcule le prix d'une excursion du panier avec le guide et la ville de l'hôtel (prix confirmé par l'API). */
function useQuotes(cart, { guides, city, promoCode, partnerCode }) {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify([cart.map((i) => i.id), guides, city, promoCode]);
  useEffect(() => {
    const items = cart.filter((i) => i.type === 'excursion');
    if (!items.length) return undefined;
    let alive = true;
    setLoading(true);
    // petite attente pendant la saisie de la ville
    const h = setTimeout(() => {
      Promise.all(items.map((i) => api.post(`/excursions/${i.excursion}/quote`, {
        date: i.date, participants: i.participants, zone: i.zone || undefined, guideLang: i.guideLang, options: i.options || [],
        guide: !!guides[i.id], city: city.trim() || undefined, promoCode: promoCode || undefined, partnerCode,
      }).then((r) => [i.id, r]).catch(() => [i.id, null])))
        .then((list) => { if (alive) { setQuotes(Object.fromEntries(list)); setLoading(false); } });
    }, 350);
    return () => { alive = false; clearTimeout(h); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { quotes, loading };
}

/** Coordonnées + validation, sans paiement (§5.3) */
export default function Checkout() {
  const { t } = useTranslation();
  const { lang, cart, clearCart, promoCode, partnerCode, currency, money, removeFromCart } = useApp();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', nationality: '', city: '', hotel: '', room: '', notes: '', accept: false, website: '' });
  const [guides, setGuides] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const countries = useMemo(() => countryList(lang), [lang]);
  const { quotes, loading } = useQuotes(cart, { guides, city: f.city, promoCode, partnerCode });
  if (cart.length === 0) return <Navigate to={path(lang, 'cart')} replace />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const hasExcursion = cart.some((i) => i.type === 'excursion');
  const lineTotal = (i) => (i.type === 'excursion' && quotes[i.id]?.price?.totalEur != null ? quotes[i.id].price.totalEur : i.estimateEur || 0);
  const total = cart.reduce((s, i) => s + lineTotal(i), 0);
  // Villes proposées : villes de départ des excursions + villes avec un transfert configuré
  const cities = [...new Set(Object.values(quotes).flatMap((q) => [...(q?.extras?.departureCities || []), ...(q?.extras?.transferCities || [])]))];
  const unit = (per) => t(per === 'person' ? 'checkout.perPerson' : per === 'vehicle' ? 'checkout.perVehicle' : 'checkout.perBooking');

  async function submit(e) {
    e.preventDefault();
    setSending(true); setError(null);
    try {
      const items = cart.map((i) => i.type === 'excursion'
        ? { type: 'excursion', excursion: i.excursion, date: i.date, participants: i.participants, zone: i.zone || undefined, guideLang: i.guideLang, options: i.options, guide: !!guides[i.id], city: f.city.trim() || undefined }
        : { type: 'transfer', participants: i.participants, transfer: i.transfer });
      const r = await api.post('/bookings', {
        items,
        customer: { name: f.name, email: f.email, phone: f.phone, nationality: f.nationality || undefined, city: f.city.trim() || undefined, hotel: f.hotel || undefined, room: f.room || undefined, notes: f.notes || undefined },
        promoCode: promoCode || undefined, partnerCode, currency, lang,
        consent: { terms: f.accept, cancellation: f.accept },
        website: f.website,
        captchaToken: window.turnstile?.getResponse?.(),
      });
      clearCart();
      nav(`${path(lang, 'booking', r.ref)}?token=${r.token}&new=1`);
    } catch (err) { setError(err); setSending(false); }
  }

  return (
    <>
      <Seo title={t('checkout.title')} noindex />
      <div className="page-head"><div className="container"><h1>{t('checkout.title')}</h1></div></div>
      <div className="container cart">
        <form className="card form" onSubmit={submit} noValidate={false}>
          <label className="field full">{t('checkout.name')} *<input required autoComplete="name" value={f.name} onChange={set('name')} /></label>
          <label className="field">{t('checkout.email')} *<input required type="email" autoComplete="email" value={f.email} onChange={set('email')} /></label>
          <label className="field">{t('checkout.phone')} *<input required type="tel" autoComplete="tel" placeholder="+44 …" value={f.phone} onChange={set('phone')} /></label>
          <label className="field">{t('checkout.nationality')} *
            <select required value={f.nationality} onChange={set('nationality')} autoComplete="country">
              <option value="">{t('checkout.nationalityPh')}</option>
              <optgroup label="—">{countries.top.map((c) => <option key={`t${c.code}`} value={c.code}>{c.name}</option>)}</optgroup>
              <optgroup label="A–Z">{countries.all.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>
            </select>
          </label>
          {hasExcursion && (
            <label className="field">{t('checkout.city')} *
              <input required list="checkout-cities" value={f.city} onChange={set('city')} placeholder={t('checkout.cityPh')} autoComplete="address-level2" />
              <datalist id="checkout-cities">{cities.map((c) => <option key={c} value={c}>{placeName(c, lang)}</option>)}</datalist>
            </label>
          )}
          {hasExcursion && <small className="muted full" style={{ marginTop: -6 }}>{t('checkout.cityHint')}</small>}
          <label className="field">{t('checkout.hotel')}<input value={f.hotel} onChange={set('hotel')} /></label>
          <label className="field">{t('checkout.room')}<input value={f.room} onChange={set('room')} /></label>
          <label className="field full">{t('checkout.notes')}<textarea value={f.notes} onChange={set('notes')} /></label>
          <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set('website')} name="website" />
          {/* Cloudflare Turnstile : <div className="cf-turnstile" data-sitekey="..."></div> si TURNSTILE_SECRET est défini */}
          <label className="check full"><input type="checkbox" required checked={f.accept} onChange={set('accept')} />
            <span>{t('checkout.accept')} (<Link to={path(lang, 'legal', 'cancellation')} target="_blank">{t('footer.cancellation')}</Link>)</span></label>
          <p className="alert alert--info full">{t('checkout.noPayment')}</p>
          {error && <div className="full">
            <ErrorBox error={error} />
            {error.body?.details?.excursion && <button type="button" className="link-btn" onClick={() => cart.filter((i) => i.excursion === error.body.details.excursion).forEach((i) => removeFromCart(i.id))}>{t('cart.remove')}</button>}
          </div>}
          <button className="btn btn--primary btn--lg full" disabled={sending || !f.accept}>{sending ? t('checkout.sending') : t('checkout.submit')}</button>
        </form>
        <aside className="stack">
          <h2 style={{ fontSize: 20 }}>{t('checkout.summary')}</h2>
          {cart.map((i) => {
            const q = i.type === 'excursion' ? quotes[i.id] : null;
            const extraLines = (q?.price?.lines || []).filter((l) => l.key === 'guide' || l.key === 'cityTransfer');
            const g = q?.extras?.guide;
            return (
              <div key={i.id} className="stack" style={{ gap: 8 }}>
                <CartLine item={{ ...i, estimateEur: lineTotal(i) }} />
                {(g || extraLines.length > 0 || q?.price?.cityTransferOnRequest) && (
                  <div className="card checkout-extras">
                    <strong style={{ fontSize: 14 }}>{t('checkout.extras')}</strong>
                    {g && (
                      <label className="check" style={{ minHeight: 0 }}>
                        <input type="checkbox" checked={!!guides[i.id]} onChange={(e) => setGuides({ ...guides, [i.id]: e.target.checked })} />
                        <span>{t('checkout.guide')} <b>+{money(g.price, 2)}</b> {unit(g.per)}</span>
                      </label>
                    )}
                    {extraLines.length > 0 && <PriceLines lines={extraLines} />}
                    {q?.price?.cityTransferOnRequest && <p className="alert alert--info" style={{ margin: 0 }}>{t('checkout.transferOnRequest', { city: q.price.cityTransferOnRequest })}</p>}
                  </div>
                )}
              </div>
            );
          })}
          <PromoBox />
          <div className="card row" style={{ justifyContent: 'space-between' }}><strong>{t('price.total')}</strong><strong className="price" aria-live="polite">{money(total, 2)}<small className="ttc"> {t('price.ttc')}</small></strong></div>
          {loading && <small className="muted" role="status">{t('checkout.updating')}</small>}
          <small className="muted">{t('price.payOnSite')} · {t('cart.finalNote')}</small>
        </aside>
      </div>
    </>
  );
}
