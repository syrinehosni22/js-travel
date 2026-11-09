import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { path } from '../i18n.js';

/** Champ lieu avec saisie semi-automatique (aéroports, villes, hôtels gérés dans l'admin) */
export function PlaceInput({ label, value, onChange }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const id = useId();
  const [q, setQ] = useState(value?.name || '');
  const [list, setList] = useState([]);
  useEffect(() => {
    const h = setTimeout(() => api.get(`/transfers/locations?q=${encodeURIComponent(q)}`, { lang }).then(setList).catch(() => {}), 200);
    return () => clearTimeout(h);
  }, [q, lang]);
  useEffect(() => { if (value?.name && value.name !== q) setQ(value.name); }, [value]); // eslint-disable-line
  return (
    <label className="field">{label}
      <input list={id} value={q} required autoComplete="off" placeholder={t('search.place')}
        onChange={(e) => { setQ(e.target.value); const m = list.find((x) => x.name === e.target.value); onChange(m || null); }} />
      <datalist id={id}>{list.map((x) => <option key={x.id} value={x.name} />)}</datalist>
    </label>
  );
}

/** Formulaire de recherche de transfert en 4 champs (§4.2). `compact` = version accueil. */
export default function TransferForm({ compact, initial, onSearch }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const nav = useNavigate();
  const [f, setF] = useState(initial || { from: null, to: null, datetime: '', adult: 2, child: 0, infant: 0, luggage: 2, flightNumber: '', childSeats: 0, nameSign: false, roundTrip: false, returnDatetime: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? +e.target.value : e.target.value) : e });

  const submit = (e) => {
    e.preventDefault();
    if (compact) {
      sessionStorage.setItem('transferSearch', JSON.stringify(f));
      nav(path(lang, 'transfers'));
    } else onSearch?.(f);
  };
  const isAirport = f.from?.type === 'airport';
  return (
    <form className="search__form" onSubmit={submit}>
      <PlaceInput label={t('search.from')} value={f.from} onChange={set('from')} />
      <PlaceInput label={t('search.to')} value={f.to} onChange={set('to')} />
      <label className="field">{t('search.datetime')}<input type="datetime-local" required value={f.datetime} onChange={set('datetime')} /></label>
      <label className="field">{t('search.passengers')}<input type="number" min="1" max="16" value={f.adult} onChange={set('adult')} /></label>
      {!compact && <>
        <label className="field">{t('calc.children')}<input type="number" min="0" max="16" value={f.child} onChange={set('child')} /></label>
        <label className="field">{t('calc.infants')}<input type="number" min="0" max="16" value={f.infant} onChange={set('infant')} /></label>
        <label className="field">{t('transfer.luggage')}<input type="number" min="0" max="20" value={f.luggage} onChange={set('luggage')} /></label>
        {isAirport && <label className="field">{t('transfer.flight')}<input value={f.flightNumber} onChange={set('flightNumber')} placeholder="TU 123" aria-describedby="fh" /><small id="fh" style={{ fontWeight: 400 }}>{t('transfer.flightHint')}</small></label>}
        <label className="field">{t('transfer.childSeats')}<input type="number" min="0" max="4" value={f.childSeats} onChange={set('childSeats')} /></label>
        <label className="check" style={{ flex: '1 1 220px' }}><input type="checkbox" checked={f.nameSign} onChange={set('nameSign')} />{t('transfer.nameSign')}</label>
        <label className="check" style={{ flex: '1 1 160px' }}><input type="checkbox" checked={f.roundTrip} onChange={set('roundTrip')} />{t('transfer.roundTrip')}</label>
        {f.roundTrip && <label className="field">{t('transfer.returnDate')}<input type="datetime-local" required value={f.returnDatetime} onChange={set('returnDatetime')} /></label>}
      </>}
      <button className="btn btn--green" style={{ minHeight: 50, borderRadius: 12 }}>{t('search.seePrices')}</button>
    </form>
  );
}
