import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp, useFetch } from '../context.jsx';
import { LANGS, path, langName, placeName } from '../i18n.js';
import { Seo, Media, TourCard, Loading, ErrorBox, Icon } from '../components/ui.jsx';
import PriceCalculator from '../components/PriceCalculator.jsx';
import NotFound from './NotFound.jsx';

const PH = ['#C7D8EA', '#EAD3B2', '#BFE0DD', '#D7D9B8', '#E3C9AE'];

/** Galerie : 1 grande + 4 petites sur ordinateur, carrousel à faire glisser sur mobile, visionneuse plein écran */
function Gallery({ images, title }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(null);
  const [idx, setIdx] = useState(0);
  const strip = useRef(null);
  const list = images?.length ? images : [{}, {}, {}];
  useEffect(() => {
    if (open == null) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);
  const onScroll = () => { const el = strip.current; if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth)); };
  return (
    <>
      <div className={`gyg-gallery gyg-gallery--${Math.min(list.length, 5)}`}>
        {list.slice(0, 5).map((img, i) => (
          <button type="button" key={i} className="gyg-gallery__item" onClick={() => images?.length && setOpen(i)} aria-label={t('detail.photos', { n: list.length })}>
            <Media src={img.url} alt={img.alt || title} ph={PH[i]} eager={i === 0} sizes={i === 0 ? '(max-width: 760px) 100vw, 60vw' : '20vw'} />
          </button>
        ))}
        {images?.length > 1 && <button type="button" className="gyg-gallery__all" onClick={() => setOpen(0)}><Icon name="grid" size={16} /> {t('detail.photos', { n: images.length })}</button>}
      </div>
      {/* Mobile : carrousel */}
      <div className="gyg-strip" ref={strip} onScroll={onScroll}>
        {list.map((img, i) => (
          <button type="button" key={i} className="gyg-strip__item" onClick={() => images?.length && setOpen(i)}>
            <Media src={img.url} alt={img.alt || title} ph={PH[i % PH.length]} eager={i === 0} sizes="100vw" />
          </button>
        ))}
        {list.length > 1 && <span className="gyg-strip__count" aria-hidden="true">{idx + 1} / {list.length}</span>}
      </div>
      {open != null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={title}>
          <button type="button" className="lightbox__close" onClick={() => setOpen(null)} aria-label={t('detail.close')}><Icon name="x" /></button>
          <div className="lightbox__list">
            {images.map((img, i) => <img key={i} src={img.url} alt={img.alt || title} loading={Math.abs(i - open) < 2 ? 'eager' : 'lazy'} ref={(el) => { if (el && i === open) el.scrollIntoView({ block: 'center' }); }} />)}
          </div>
        </div>
      )}
    </>
  );
}

/** « Afficher plus » pour les longues descriptions */
function Collapsible({ text }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const paras = text.split(/\n\s*\n/);
  const long = text.length > 420;
  return (
    <div>
      <div className={`prose gyg-desc${long && !open ? ' is-clamped' : ''}`}>{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
      {long && <button type="button" className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? t('detail.showLess') : t('detail.showMore')}</button>}
    </div>
  );
}

function AboutItem({ icon, title, children }) {
  return (
    <li><span className="about__icon"><Icon name={icon} size={22} /></span><div><strong>{title}</strong>{children && <p>{children}</p>}</div></li>
  );
}

export default function ExcursionDetail() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const { lang, settings, money } = useApp();
  const nav = useNavigate();
  const { data: e, loading, error } = useFetch(() => api.get(`/excursions/${encodeURIComponent(slug)}`, { lang }), [slug, lang]);

  // Ancien slug ou slug d'une autre langue : redirection vers l'URL de la langue courante
  useEffect(() => { if (e?.redirect) nav(path(lang, 'excursions', e.redirect), { replace: true }); }, [e, lang, nav]);

  if (loading) return <Loading />;
  if (error?.status === 404) return <NotFound />;
  if (error) return <div className="container"><ErrorBox error={error} /></div>;
  if (!e || e.redirect) return null;

  const seo = e.seo || {};
  const c = settings?.contact || {};
  const maxGroup = e.pricing?.maxGroup || 8;
  const cancelH = e.cancellationFreeHours || 24;
  const cities = (e.departureCities || []).map((x) => placeName(x, lang));
  const languages = (e.guideLanguages || []).map((l) => langName(l, lang));
  const alternates = Object.fromEntries(LANGS.filter((l) => e.slugs?.[l]).map((l) => [l, path(l, 'excursions', e.slugs[l])]));
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': ['TouristTrip', 'Product'], name: e.title, description: e.summary,
      image: e.images?.map((i) => i.url), touristType: 'Private group',
      offers: e.from?.amount ? { '@type': 'Offer', price: e.from.amount, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } : undefined,
      ...(e.rating?.value && { aggregateRating: { '@type': 'AggregateRating', ratingValue: e.rating.value, reviewCount: e.rating.count } }),
    },
    e.faq?.length && { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: e.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('nav.home'), item: `${location.origin}/${lang}` },
      { '@type': 'ListItem', position: 2, name: t('nav.excursions'), item: location.origin + path(lang, 'excursions') },
      { '@type': 'ListItem', position: 3, name: e.title },
    ] },
  ].filter(Boolean);
  const hasImportant = e.toBring?.length > 0 || e.minAge > 0 || e.notIncluded?.length > 0;

  return (
    <>
      <Seo title={seo.metaTitle || e.title} description={seo.metaDescription || e.summary} canonical={seo.canonical || path(lang, 'excursions', e.slug)}
        alternates={alternates} image={seo.ogImage || e.images?.[0]?.url} noindex={seo.index === false} jsonLd={jsonLd} />
      <div className="container gyg">
        <nav aria-label={t('common.breadcrumb')} className="gyg-crumbs">
          <a href={`/${lang}`}>{t('nav.home')}</a><span aria-hidden="true">›</span><a href={path(lang, 'excursions')}>{t('nav.excursions')}</a>{e.category && <><span aria-hidden="true">›</span><a href={`${path(lang, 'excursions')}?category=${e.category}`}>{t(`cat.${e.category}`)}</a></>}
        </nav>

        <header className="gyg-head">
          <div className="row" style={{ gap: 8 }}>{e.badges?.map((b) => <span key={b} className={`tag tag--${b}`}>{t(`badge.${b}`)}</span>)}</div>
          <h1>{seo.h1 || e.title}</h1>
          <div className="gyg-head__meta">
            {e.rating?.value && <span className="stars"><Icon name="star" size={16} /> <b>{e.rating.value}</b> ({t('detail.reviewsN', { n: e.rating.count })})</span>}
            {e.durationLabel && <span><Icon name="clock" size={16} /> {e.durationLabel}</span>}
            {cities.length > 0 && <span><Icon name="pin" size={16} /> {cities.join(', ')}</span>}
          </div>
        </header>

        <Gallery images={e.images} title={e.title} />

        <div className="gyg-body">
          <div className="gyg-top">
            {e.summary && <p className="gyg-summary">{e.summary}</p>}
            <section className="gyg-sec">
              <h2>{t('detail.about')}</h2>
              <ul className="about">
                <AboutItem icon="check" title={t('detail.freeCancelTitle')}>{t('detail.freeCancelText', { h: cancelH })}</AboutItem>
                <AboutItem icon="wallet" title={t('detail.payLaterTitle')}>{t('detail.payLaterText')}</AboutItem>
                {e.durationLabel && <AboutItem icon="clock" title={`${t('detail.duration')} : ${e.durationLabel}`}>{e.startTimes?.length ? t('detail.startAt', { times: e.startTimes.join(', ') }) : null}</AboutItem>}
                {languages.length > 0 && <AboutItem icon="guide" title={t('detail.guideTitle')}>{languages.join(', ')}</AboutItem>}
                {cities.length > 0 && <AboutItem icon="pin" title={t('detail.pickupTitle')}>{t('detail.pickupText', { cities: cities.join(', ') })}</AboutItem>}
                <AboutItem icon="users" title={t('detail.privateTitle')}>{t('detail.privateText', { n: maxGroup })}</AboutItem>
                <AboutItem icon="bolt" title={e.availability?.mode === 'instant' ? t('calc.instant') : t('detail.confirmTitle')}>{e.availability?.mode === 'instant' ? null : t('calc.onRequest', { h: e.availability?.confirmWithinHours || 12 })}</AboutItem>
              </ul>
            </section>
          </div>

          <aside className="gyg-aside" id="calculator">
            <PriceCalculator excursion={e} />
          </aside>

          <div className="gyg-rest">
            {(e.highlights?.length > 0 || e.description) && (
              <section className="gyg-sec">
                <h2>{t('detail.experience')}</h2>
                {e.highlights?.length > 0 && <div className="gyg-row"><h3>{t('detail.highlights')}</h3><ul className="dots">{e.highlights.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                {e.description && <div className="gyg-row"><h3>{t('detail.fullDescription')}</h3><Collapsible text={e.description} /></div>}
              </section>
            )}

            {(e.included?.length > 0 || e.notIncluded?.length > 0) && (
              <section className="gyg-sec">
                <h2>{t('detail.includes')}</h2>
                <ul className="incl">
                  {e.included?.map((x, i) => <li key={`i${i}`} className="yes"><Icon name="check" size={18} />{x}</li>)}
                  {e.notIncluded?.map((x, i) => <li key={`n${i}`} className="no"><Icon name="x" size={18} />{x}</li>)}
                </ul>
              </section>
            )}

            {e.program?.length > 0 && (
              <section className="gyg-sec">
                <h2>{t('detail.program')}</h2>
                <ol className="timeline">{e.program.map((s, i) => <li key={i}>{s.time && <time>{s.time}</time>}<span>{s.text}</span></li>)}</ol>
              </section>
            )}

            {cities.length > 0 && (
              <section className="gyg-sec">
                <h2>{t('detail.meetingPoint')}</h2>
                <p>{t('detail.pickupText', { cities: cities.join(', ') })}</p>
                {e.pricing?.zones?.some((z) => z.fee) && <p className="muted">{e.pricing.zones.filter((z) => z.fee).map((z) => `${placeName(z.label || z.key, lang)} +${money(z.fee)}`).join(' · ')}</p>}
                {e.mapEmbed && <iframe title={t('common.map')} src={e.mapEmbed} className="gyg-map" loading="lazy" />}
              </section>
            )}

            {hasImportant && (
              <section className="gyg-sec">
                <h2>{t('detail.importantInfo')}</h2>
                {e.toBring?.length > 0 && <div className="gyg-row"><h3>{t('detail.bring')}</h3><ul className="dots">{e.toBring.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                <div className="gyg-row"><h3>{t('detail.knowBefore')}</h3>
                  <ul className="dots">
                    {e.minAge > 0 && <li>{t('detail.minAgeText', { n: e.minAge })}</li>}
                    <li>{t('detail.privateText', { n: maxGroup })}</li>
                    <li>{t('detail.freeCancelText', { h: cancelH })}</li>
                  </ul>
                </div>
              </section>
            )}

            {e.faq?.length > 0 && (
              <section className="gyg-sec">
                <h2>{t('detail.faq')}</h2>
                <div className="faq" style={{ margin: 0 }}>{e.faq.map((f, i) => <details key={i}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
              </section>
            )}

            <section className="gyg-sec gyg-contact">
              <strong>{t('detail.contact')}</strong>
              <div className="row">
                {c.whatsapp && <a className="btn btn--whatsapp" href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(e.title)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                {c.viber && <a className="btn btn--outline" href={`viber://chat?number=${encodeURIComponent(c.viber)}`}>Viber</a>}
                {c.email && <a className="btn btn--outline" href={`mailto:${c.email}?subject=${encodeURIComponent(e.title)}`}>{t('detail.email')}</a>}
              </div>
            </section>
          </div>
        </div>
      </div>

      {e.related?.length > 0 && (
        <section className="section section--alt">
          <div className="container">
            <h2 className="section__title" style={{ marginBottom: 24 }}>{t('detail.like')}</h2>
            <div className="tour-grid">{e.related.map((r) => <TourCard key={r.id} e={r} />)}</div>
          </div>
        </section>
      )}
    </>
  );
}
