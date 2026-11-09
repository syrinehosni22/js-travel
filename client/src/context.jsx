import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { formatMoney } from '@tt/shared';
import { api } from './api.js';

const AppCtx = createContext(null);
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/** État global : langue, devise, paramètres publics et panier partagé excursions + transferts (§5). */
export function AppProvider({ lang, children }) {
  const [settings, setSettings] = useState(null);
  const [currency, setCurrencyState] = useState(() => store.get('currency', 'EUR'));
  const [cart, setCart] = useState(() => store.get('cart', []));
  const [promoCode, setPromo] = useState(() => store.get('promo', ''));

  useEffect(() => { api.get('/settings', { lang }).then(setSettings).catch(() => setSettings({})); }, [lang]);
  useEffect(() => store.set('cart', cart), [cart]);
  useEffect(() => store.set('promo', promoCode), [promoCode]);

  // Code partenaire dans l'URL (?partner=HOTEL123) mémorisé pour la réservation
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('partner');
    if (p) store.set('partner', p);
  }, []);

  const setCurrency = (c) => { setCurrencyState(c); store.set('currency', c); };
  const rate = settings?.fx?.[currency] || 1;
  const effectiveCurrency = settings?.fx?.[currency] ? currency : 'EUR';

  /** Prix en EUR → chaîne formatée dans la devise choisie */
  const money = useCallback((eur, digits) => {
    if (eur == null || Number.isNaN(eur)) return '';
    const d = digits ?? (Number.isInteger(eur) && effectiveCurrency === 'EUR' ? 0 : 2);
    return formatMoney(eur * (effectiveCurrency === 'EUR' ? 1 : rate), effectiveCurrency, lang, d);
  }, [rate, effectiveCurrency, lang]);

  const addToCart = (item) => setCart((c) => [...c, { ...item, id: crypto.randomUUID?.() || String(Date.now()) }]);
  const removeFromCart = (id) => setCart((c) => c.filter((x) => x.id !== id));
  const clearCart = () => setCart([]);

  const value = useMemo(() => ({
    lang, settings, currency: effectiveCurrency, setCurrency, rate, money,
    cart, addToCart, removeFromCart, clearCart, promoCode, setPromo, partnerCode: store.get('partner', undefined),
  }), [lang, settings, effectiveCurrency, rate, money, cart, promoCode]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export const useApp = () => useContext(AppCtx);

/** Petit hook de chargement de données */
export function useFetch(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
