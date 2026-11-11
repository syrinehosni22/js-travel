import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { LANGS, path } from '../i18n.js';
import { Seo, PriceLines, ErrorBox, TourCard, Media } from '../components/ui.jsx';
import TransferForm from '../components/TransferForm.jsx';
import { waLink } from '../whatsapp.js';

export default function Transfers() {
  const { t } = useTranslation();
  const { lang, money, addToCart, promoCode, currency, settings } = useApp();
  const { slug } = useParams();
  const nav = useNavigate();
  const [initial] = useState(() => { try { return JSON.parse(sessionStorage.getItem('transferSearch')); } catch { return null; } });
  const [search, setSearch] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [cross, setCross] = useState([]);
  const [landing, setLanding] = useState(null);

  // Page de destination SEO (ex. /fr/transferts/transfert-aeroport-enfidha-sousse)
  useEffect(() => { if (slug) api.get(`/transfers/routes/${slug}`, { lang }).then(setLanding).catch(() => setLanding(null)); }, [slug, lang]);

  async function run(f) {
    setSearch(f); setError(null); setResult(null);
    try {
      const r = await api.post('/transfers/quote', {
        fromId: f.from?.id, toId: f.to?.id, datetime: f.datetime, flightNumber: f.flightNumber || undefined,
        passengers: { adult: f.adult, child: f.child, infant: f.infant }, luggage: f.luggage, childSeats: f.childSeats, nameSign: f.nameSign,
        roundTrip: f.roundTrip, returnDatetime: f.roundTrip ? f.returnDatetime : undefined, promoCode: promoCode || undefined, currency,
      }, { lang });
      setResult(r);
      // Vente croisée : excursions au départ de la ville d'arrivée (§4.4)
      const city = f.to?.type !== 'airport' ? f.to?.name : null;
      if (city) api.get(`/excursions?city=${encodeURIComponent(city)}`, { lang }).then((x) => setCross(x.slice(0, 3))).catch(() => {});
    } catch (e) { setError(e); }
  }
  useEffect(() => { if (initial?.from && initial?.to && initial?.datetime) { sessionStorage.removeItem('transferSearch'); run(initial); } }, []); // eslint-disable-line

  function choose(q) {
    const f = search;
    addToCart({
      type: 'transfer', title: `${f.from.name} → ${f.to.name}`, participants: { adult: f.adult, child: f.child, infant: f.infant },
      date: f.datetime.slice(0, 10), estimateEur: q.totalEur, vehicleLabel: q.label,
      transfer: { fromId: f.from.id, toId: f.to.id, from: f.from.name, to: f.to.name, datetime: f.datetime, flightNumber: f.flightNumber || undefined, vehicle: q.vehicle, luggage: f.luggage, childSeats: f.childSeats, nameSign: f.nameSign, roundTrip: f.roundTrip, returnDatetime: f.roundTrip ? f.returnDatetime : undefined },
    });
    nav(path(lang, 'cart'));
  }

  // Véhicule « sur demande » (ex. VIP) : demande de devis par WhatsApp, sinon page contact
  function quoteRequest(q) {
    const f = search || {};
    const n = (+f.adult || 0) + (+f.child || 0) + (+f.infant || 0);
    const text = t('transfer.quoteMsg', { vehicle: q.label, from: f.from?.name || '', to: f.to?.name || '', date: (f.datetime || '').replace('T', ' '), n });
    return waLink(settings?.contact?.whatsapp, text);
  }

  return (
    <>
      <Seo title={landing?.seo?.metaTitle || landing?.title || t('transfer.title')} description={landing?.seo?.metaDescription || t('transfer.subtitle')}
        alternates={Object.fromEntries(LANGS.map((l) => [l, landing?.slug?.[l] ? path(l, 'transfers', landing.slug[l]) : path(l, 'transfers')]))} />
      <div className="page-head page-head--photo"><Media photo="mahdia" alt="" sizes="100vw" eager /><div className="container">
        <h1>{landing?.title || t('transfer.title')}</h1>
        <p>{landing?.description || t('transfer.subtitle')}</p>
      </div></div>
      <div className="container" style={{ padding: '32px 24px 88px' }}>
        <div className="search__card" style={{ marginBottom: 32 }}><TransferForm initial={initial} onSearch={run} /></div>
        {error && <ErrorBox error={error} />}
        {result && result.quotes.length === 0 && <p className="alert alert--info">{t('transfer.none')}</p>}
        {result && (
          <div className="vehicles">
            {result.quotes.map((q) => (
              <article key={q.vehicle} className="card vehicle">
                <div style={{ flex: '1 1 260px' }}>
                  <h3>{q.label}</h3>
                  <p className="muted">{t('transfer.range', { min: q.minPassengers || 1, max: q.maxPassengers, l: q.maxLuggage })}</p>
                  {q.night && <span className="tag">{t('transfer.night')}</span>}
                </div>
                {q.onRequest ? (
                  <>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}><div className="price">{t('transfer.onRequest')}</div><small className="muted">{t('transfer.onRequestHint')}</small></div>
                    {quoteRequest(q)
                      ? <a className="btn btn--outline" href={quoteRequest(q)} target="_blank" rel="noopener noreferrer">{t('transfer.askQuote')}</a>
                      : <a className="btn btn--outline" href={path(lang, 'contact')}>{t('transfer.askQuote')}</a>}
                  </>
                ) : (
                  <>
                    <details style={{ flex: '1 1 220px' }}><summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>{t('price.details')}</summary><PriceLines lines={q.lines} /></details>
                    <div style={{ textAlign: 'right' }}>
                      <div className="price">{money(q.totalEur, 2)}<small className="ttc"> {t('price.ttc')}</small></div>
                      <small className="muted">{t('price.payOnSite')}</small>
                    </div>
                    <button className="btn btn--primary" onClick={() => choose(q)}>{t('transfer.choose')}</button>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
        {cross.length > 0 && (
          <section style={{ marginTop: 56 }}>
            <h2 className="section__title" style={{ marginBottom: 20 }}>{t('detail.like')}</h2>
            <div className="tour-grid">{cross.map((e) => <TourCard key={e.id} e={e} />)}</div>
          </section>
        )}
      </div>
    </>
  );
}
