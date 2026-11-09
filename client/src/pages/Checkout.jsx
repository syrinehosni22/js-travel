import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { path } from '../i18n.js';
import { Seo, ErrorBox } from '../components/ui.jsx';
import { CartLine, PromoBox } from './Cart.jsx';

/** Coordonnées + validation, sans paiement (§5.3) */
export default function Checkout() {
  const { t } = useTranslation();
  const { lang, cart, clearCart, promoCode, partnerCode, currency, money, removeFromCart } = useApp();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', hotel: '', room: '', notes: '', accept: false, website: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  if (cart.length === 0) return <Navigate to={path(lang, 'cart')} replace />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const total = cart.reduce((s, i) => s + (i.estimateEur || 0), 0);

  async function submit(e) {
    e.preventDefault();
    setSending(true); setError(null);
    try {
      const items = cart.map((i) => i.type === 'excursion'
        ? { type: 'excursion', excursion: i.excursion, date: i.date, participants: i.participants, zone: i.zone || undefined, guideLang: i.guideLang, options: i.options }
        : { type: 'transfer', participants: i.participants, transfer: i.transfer });
      const r = await api.post('/bookings', {
        items, customer: { name: f.name, email: f.email, phone: f.phone, hotel: f.hotel || undefined, room: f.room || undefined, notes: f.notes || undefined },
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
          {cart.map((i) => <CartLine key={i.id} item={i} />)}
          <PromoBox />
          <div className="card row" style={{ justifyContent: 'space-between' }}><strong>{t('price.total')}</strong><strong className="price">{money(total, 2)}</strong></div>
          <small className="muted">{t('price.payOnSite')} · {t('cart.finalNote')}</small>
        </aside>
      </div>
    </>
  );
}
