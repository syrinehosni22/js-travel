import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp, useFetch } from '../context.jsx';
import { path, LANGS, placeName } from '../i18n.js';
import { Media, Seo, TourCard } from '../components/ui.jsx';
import TransferForm from '../components/TransferForm.jsx';
import About from '../components/About.jsx';
import { waLink } from '../whatsapp.js';

const SLIDES = ['sidiBouSaidStreet', 'ksarGhilane', 'djerbaBeach'];
const DESTINATIONS = [
  { name: 'Sidi Bou Saïd', photo: 'sidiBouSaidSea', q: 'Sidi' },
  { name: 'Sahara', photo: 'saharaDune', category: 'desert' },
  { name: 'Djerba', photo: 'houmtSouk', q: 'Djerba' },
  { name: 'Tozeur & Chebika', photo: 'southPalm', q: 'Tozeur' },
  { name: 'El Jem', photo: 'elJem', q: 'Jem' },
];

function Hero() {
  const { t } = useTranslation();
  const { lang, settings } = useApp();
  const [i, setI] = useState(0);
  const paused = useRef(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => { if (!paused.current) setI((x) => (x + 1) % SLIDES.length); }, 6000);
    return () => clearInterval(id);
  }, []);
  const wa = waLink(settings?.contact?.whatsapp, t('hero.waText'));
  return (
    <section className="hero" aria-roledescription="carousel" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)} onFocus={() => (paused.current = true)}>
      {SLIDES.map((key, k) => <Media key={key} photo={key} alt="" sizes="100vw" className={`hero__slide${k === i ? ' is-active' : ''}`} eager={k === 0} />)}
      <div className="container hero__content">
        <span className="eyebrow">{t('hero.eyebrow')}</span>
        <h1>{t('hero.title')}</h1>
        <p>{t('hero.text')}</p>
        <div className="hero__ctas">
          <Link to={path(lang, 'excursions')} className="btn btn--primary btn--lg">{t('hero.see')}</Link>
          {wa && <a href={wa} className="btn btn--ghost btn--lg" target="_blank" rel="noopener noreferrer">{t('hero.whatsapp')}</a>}
        </div>
        <div className="hero__dots" role="tablist">
          {SLIDES.map((_, k) => <button key={k} className={`hero__dot${k === i ? ' is-active' : ''}`} role="tab" aria-selected={k === i} aria-label={t('hero.slide', { n: k + 1 })} onClick={() => setI(k)} />)}
        </div>
      </div>
    </section>
  );
}

function SearchBox() {
  const { t } = useTranslation();
  const { lang } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState('excursion');
  const [f, setF] = useState({ category: '', city: '', date: '', people: 2 });
  const submit = (e) => {
    e.preventDefault();
    const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '' && v != null));
    nav(`${path(lang, 'excursions')}?${q}`);
  };
  return (
    <section className="search" aria-label={t('search.submit')}>
      <div className="container"><div className="search__card">
        <div className="search__tabs" role="tablist">
          {['excursion', 'transfer'].map((k) => <button key={k} className="search__tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t(`search.${k}`)}</button>)}
        </div>
        {tab === 'excursion' ? (
          <form className="search__form" onSubmit={submit}>
            <label className="field">{t('search.destination')}
              <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                <option value="">{t('search.all')}</option>
                {['culture', 'desert', 'sea', 'adventure', 'family'].map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}
              </select>
            </label>
            <label className="field">{t('search.pickup')}
              <select value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>
                <option value="">{t('search.all')}</option>
                {['Sousse', 'Hammamet', 'Monastir', 'Mahdia', 'Tunis'].map((c) => <option key={c} value={c}>{placeName(c, lang)}</option>)}
              </select>
            </label>
            <label className="field">{t('search.date')}<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <label className="field">{t('search.people')}<input type="number" min="1" max="8" value={f.people} onChange={(e) => setF({ ...f, people: e.target.value })} /></label>
            <button className="btn btn--green" style={{ minHeight: 50, borderRadius: 12 }}>{t('search.submit')}</button>
          </form>
        ) : <TransferForm compact />}
      </div></div>
    </section>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const { lang, settings } = useApp();
  const { data: tours } = useFetch(() => api.get('/excursions?sort=popularity', { lang }), [lang]);
  const { data: posts } = useFetch(() => api.get('/posts?limit=3', { lang }), [lang]);
  const seo = settings?.seoHome || {};
  const reviews = settings?.reviews;
  const included = t('home.included');
  return (
    <>
      <Seo
        title={seo.metaTitle || t('hero.eyebrow')}
        description={seo.metaDescription || t('hero.text')}
        alternates={Object.fromEntries(LANGS.map((l) => [l, `/${l}`]))}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'JS Travel Tunisia', logo: `${location.origin}/brand/icon-512.png`, telephone: settings?.contact?.phone, address: settings?.contact?.address,
          ...(reviews?.rating && { aggregateRating: { '@type': 'AggregateRating', ratingValue: reviews.rating, reviewCount: reviews.count } }) }}
      />
      <Hero />
      <SearchBox />

      <section className="section">
        <div className="container">
          <div className="section__head section__head--center"><span className="eyebrow">{t('home.destinations')}</span><h2 className="section__title">{t('home.destinationsTitle')}</h2></div>
          <div className="dest-grid">
            {DESTINATIONS.map((d) => (
              <Link key={d.name} className="dest" to={`${path(lang, 'excursions')}?${d.category ? `category=${d.category}` : `q=${encodeURIComponent(d.q)}`}`}>
                <Media photo={d.photo} sizes="(max-width: 640px) 78vw, (max-width: 1100px) 50vw, 20vw" />
                <div className="dest__label"><strong>{placeName(d.name, lang)}</strong></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section aria-label={t('nav.transfers')}>
        <div className="container"><div className="promo">
          <div><h2>{t('home.banner')}</h2><p>{t('home.bannerText')}</p></div>
          <Link to={path(lang, 'transfers')} className="btn btn--lg">{t('home.bookTransfer')}</Link>
        </div></div>
      </section>

      <About />

      <section className="section section--alt">
        <div className="container">
          <div className="section__head">
            <div><span className="eyebrow">{t('home.popular')}</span><h2 className="section__title">{t('home.popularTitle')}</h2></div>
            <Link to={path(lang, 'excursions')} className="btn btn--outline">{t('home.all')}</Link>
          </div>
          <div className="tour-grid">{(Array.isArray(tours) ? tours : []).slice(0, 6).map((e) => <TourCard key={e.id} e={e} />)}</div>
        </div>
      </section>

      <section className="section">
        <div className="container why">
          <div className="why__media">
            <Media className="why__tall" photo="sousseMedina" sizes="(max-width: 900px) 50vw, 25vw" />
            <div className="why__stack">
              <Media photo="camel" sizes="(max-width: 900px) 50vw, 25vw" />
              <div className="why__stat"><strong>{t('home.statValue')}</strong><span>{t('home.stat')}</span></div>
            </div>
          </div>
          <div className="why__text">
            <span className="eyebrow">{t('home.why')}</span>
            <h2 className="section__title">{t('home.whyTitle')}</h2>
            <ul className="checklist">{Array.isArray(included) && included.map((x) => <li key={x}>{x}</li>)}</ul>
            <Link to={path(lang, 'contact')} className="btn btn--green btn--lg">{t('nav.contact')}</Link>
          </div>
        </div>
      </section>

      <section className="section section--dark">
        <div className="container">
          <div className="section__head">
            <div><span className="eyebrow">{t('home.reviews')}</span><h2 className="section__title">{reviews?.rating ? `${reviews.rating} / 5 · ${reviews.count}` : t('home.reviews')}</h2></div>
            <div className="review-links">
              {settings?.social?.tripadvisor && <a href={settings.social.tripadvisor} target="_blank" rel="noopener noreferrer">{t('home.readAll')}</a>}
              {settings?.social?.googleReviews && <a href={settings.social.googleReviews} target="_blank" rel="noopener noreferrer">{t('home.leave')}</a>}
            </div>
          </div>
          {/* Emplacement du widget unifié Tripadvisor + Google (script fourni par le prestataire d'avis) */}
          <div id="reviews-widget" className="review-grid" />
        </div>
      </section>

      {Array.isArray(posts) && posts.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section__head section__head--center"><span className="eyebrow">{t('nav.blog')}</span><h2 className="section__title">{t('home.blogTitle')}</h2></div>
            <div className="blog-grid">{posts.map((p) => (
              <article className="post" key={p.id}>
                <Media src={p.image} alt={p.imageAlt} ph="#C7D8EA" sizes="(max-width: 700px) 100vw, 400px" />
                <h3><Link to={path(lang, 'blog', p.slug)}>{p.title}</Link></h3>
                <Link to={path(lang, 'blog', p.slug)}>{t('common.readMore')} →</Link>
              </article>
            ))}</div>
          </div>
        </section>
      )}

      {settings?.faq?.length > 0 && (
        <section className="section section--alt">
          <div className="container">
            <div className="section__head section__head--center"><span className="eyebrow">{t('nav.faq')}</span><h2 className="section__title">{t('home.faqTitle')}</h2></div>
            <div className="faq">{settings.faq.map((f, k) => <details key={k} open={k === 0}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
          </div>
        </section>
      )}
    </>
  );
}

