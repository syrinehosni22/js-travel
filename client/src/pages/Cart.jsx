import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { path } from '../i18n.js';
import { Seo, Media } from '../components/ui.jsx';

export function CartLine({ item, onRemove }) {
  const { t } = useTranslation();
  const { money } = useApp();
  const p = item.participants || {};
  return (
    <div className="card cart-item">
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        {item.type === 'excursion' && <Media src={item.image} ph="#C7D8EA" style={{ width: 88, height: 88, borderRadius: 12, flex: 'none' }} />}
        <div>
          <strong>{item.title}</strong>
          <div className="muted" style={{ fontSize: 14 }}>
            {item.type === 'transfer' ? item.transfer.datetime.replace('T', ' · ') : item.date} · {p.adult} {t('price.adult')}{p.child ? `, ${p.child} ${t('price.child')}` : ''}{p.infant ? `, ${p.infant} ${t('price.infant')}` : ''}
            {item.vehicleLabel ? ` · ${item.vehicleLabel}` : ''}
          </div>
          {onRemove && <button className="link-btn" onClick={onRemove}>{t('cart.remove')}</button>}
        </div>
      </div>
      <strong style={{ whiteSpace: 'nowrap' }}>{money(item.estimateEur, 2)}</strong>
    </div>
  );
}

export function PromoBox() {
  const { t } = useTranslation();
  const { promoCode, setPromo } = useApp();
  const [code, setCode] = useState(promoCode);
  const [state, setState] = useState(null);
  const apply = async (e) => {
    e.preventDefault();
    const r = await api.post('/promo/check', { code }).catch(() => ({ valid: false }));
    setState(r);
    setPromo(r.valid ? code.toUpperCase() : '');
  };
  return (
    <form onSubmit={apply} className="stack" style={{ gap: 8 }}>
      <label className="field">{t('cart.promo')}
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} style={{ flex: 1, height: 48, border: '1px solid var(--field)', borderRadius: 12, padding: '0 12px' }} />
          <button className="btn btn--outline">{t('cart.apply')}</button>
        </div>
      </label>
      {state && <span className={`alert ${state.valid ? 'alert--ok' : 'alert--warn'}`}>{state.valid ? t('cart.promoOk', { pct: Math.round(state.rate * 100) }) : t('cart.promoBad')}</span>}
    </form>
  );
}

export default function Cart() {
  const { t } = useTranslation();
  const { lang, cart, removeFromCart, money } = useApp();
  const total = cart.reduce((s, i) => s + (i.estimateEur || 0), 0);
  return (
    <>
      <Seo title={t('cart.title')} noindex />
      <div className="page-head"><div className="container"><h1>{t('cart.title')}</h1></div></div>
      <div className="container cart">
        <div className="stack">
          {cart.length === 0 && <p className="alert alert--info">{t('cart.empty')} <Link to={path(lang, 'excursions')}>{t('cart.continue')}</Link></p>}
          {cart.map((i) => <CartLine key={i.id} item={i} onRemove={() => removeFromCart(i.id)} />)}
          {cart.length > 0 && <Link to={path(lang, 'excursions')}>{t('cart.continue')}</Link>}
        </div>
        {cart.length > 0 && (
          <aside className="card stack">
            <PromoBox />
            <div className="row" style={{ justifyContent: 'space-between' }}><strong>{t('cart.total')}</strong><strong className="price">{money(total, 2)}</strong></div>
            <small className="muted">{t('price.payOnSite')} · {t('cart.finalNote')}</small>
            <Link to={path(lang, 'checkout')} className="btn btn--primary btn--lg">{t('cart.checkout')}</Link>
          </aside>
        )}
      </div>
    </>
  );
}
