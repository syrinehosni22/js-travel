import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp, useFetch } from '../context.jsx';
import { LANGS, path, langName, placeName } from '../i18n.js';
import { Seo, TourCard, Loading, ErrorBox, Media } from '../components/ui.jsx';

/** Catalogue : filtres, tri et recherche (§5.1) */
export default function Excursions() {
  const { t } = useTranslation();
  const { lang } = useApp();
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const set = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); setParams(p, { replace: true }); };
  const query = ['category', 'city', 'maxHours', 'maxPrice', 'guideLang', 'q', 'sort'].map((k) => get(k) && `${k}=${encodeURIComponent(get(k))}`).filter(Boolean).join('&');
  const [showFilters, setShowFilters] = useState(false);
  const active = ['category', 'city', 'maxHours', 'maxPrice', 'guideLang', 'q'].filter((k) => get(k)).length;
  const { data, loading, error } = useFetch(() => api.get(`/excursions?${query}`, { lang }), [lang, query]);

  return (
    <>
      <Seo title={t('catalog.title')} alternates={Object.fromEntries(LANGS.map((l) => [l, path(l, 'excursions')]))} />
      <div className="page-head page-head--photo"><Media photo="sidiBouSaidMosque" alt="" sizes="100vw" eager /><div className="container"><h1>{t('catalog.title')}</h1><p>{t('hero.text')}</p></div></div>
      <div className="container catalog">
        <button type="button" className="filters-toggle" aria-expanded={showFilters} aria-controls="filters" onClick={() => setShowFilters(!showFilters)}>
          {t('catalog.filters')} {active > 0 && <b>{active}</b>}
        </button>
        <aside id="filters" className={`filters card${showFilters ? ' is-open' : ''}`} aria-label={t('catalog.filters')}>
          <label className="field">{t('catalog.search')}<input type="search" defaultValue={get('q')} onKeyDown={(e) => e.key === 'Enter' && set('q', e.currentTarget.value)} onBlur={(e) => set('q', e.target.value)} /></label>
          <label className="field">{t('catalog.category')}
            <select value={get('category')} onChange={(e) => set('category', e.target.value)}>
              <option value="">{t('catalog.any')}</option>
              {['culture', 'desert', 'sea', 'adventure', 'family'].map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}
            </select>
          </label>
          <label className="field">{t('catalog.city')}
            <select value={get('city')} onChange={(e) => set('city', e.target.value)}>
              <option value="">{t('catalog.any')}</option>
              {['Sousse', 'Hammamet', 'Monastir', 'Mahdia', 'Tunis'].map((c) => <option key={c} value={c}>{placeName(c, lang)}</option>)}
            </select>
          </label>
          <label className="field">{t('catalog.duration')}
            <select value={get('maxHours')} onChange={(e) => set('maxHours', e.target.value)}>
              <option value="">{t('catalog.any')}</option>
              <option value="5">{t('catalog.halfDay')}</option><option value="12">{t('catalog.day')}</option><option value="100">{t('catalog.multi')}</option>
            </select>
          </label>
          <label className="field">{t('catalog.maxPrice')} (€)<input type="number" min="0" step="10" value={get('maxPrice')} onChange={(e) => set('maxPrice', e.target.value)} /></label>
          <label className="field">{t('catalog.guideLang')}
            <select value={get('guideLang')} onChange={(e) => set('guideLang', e.target.value)}>
              <option value="">{t('catalog.any')}</option>
              {LANGS.map((l) => <option key={l} value={l}>{langName(l, lang)}</option>)}
            </select>
          </label>
          <button className="link-btn" onClick={() => setParams({})}>{t('catalog.reset')}</button>
        </aside>
        <div>
          <div className="catalog__bar">
            <span className="muted" aria-live="polite">{data ? t('catalog.results', { count: data.length }) : ''}</span>
            <label className="row" style={{ fontWeight: 600 }}>{t('catalog.sort')}
              <select className="lang-select" value={get('sort') || 'popularity'} onChange={(e) => set('sort', e.target.value)}>
                <option value="popularity">{t('catalog.popularity')}</option><option value="price">{t('catalog.price')}</option><option value="duration">{t('catalog.duration_')}</option>
              </select>
            </label>
          </div>
          {loading && <Loading />}
          {error && <ErrorBox error={error} />}
          {data && data.length === 0 && <p className="alert alert--info">{t('catalog.empty')}</p>}
          {data && <div className="tour-grid">{data.map((e) => <TourCard key={e.id} e={e} />)}</div>}
        </div>
      </div>
    </>
  );
}
