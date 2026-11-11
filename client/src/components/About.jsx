import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context.jsx';
import { path } from '../i18n.js';
import { assetUrl } from '../api.js';
import { Media } from './ui.jsx';

/** Reconnaît une vidéo YouTube, Vimeo ou un fichier MP4 et renvoie de quoi l'afficher */
export function parseVideo(url) {
  const u = (url || '').trim();
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0&modestbranding=1`, poster: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vm[1]}?autoplay=1&dnt=1` };
  if (/\.(mp4|webm)(\?.*)?$/i.test(u)) return { kind: 'file', src: assetUrl(u) };
  return null;
}

const ICONS = {
  compass: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>,
  car: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 16V11l2-5h10l2 5v5" /><path d="M3 16h18v3H3z" /><circle cx="7.5" cy="16" r="1.5" /><circle cx="16.5" cy="16" r="1.5" /><path d="M5 11h14" /></svg>,
};

/** Rubrique « Notre entreprise » de l'accueil — contenu modifiable dans Admin → Paramètres */
export default function About() {
  const { t } = useTranslation();
  const { lang, settings } = useApp();
  const [playing, setPlaying] = useState(false);
  const a = settings?.about;
  if (!settings || a?.enabled === false) return null;

  const title = a?.title || t('about.title');
  const text = String(a?.text || t('about.text'));
  const video = parseVideo(a?.video);
  const poster = a?.image || video?.poster;
  const stats = a?.stats || [];
  const services = t('about.services', { returnObjects: true });

  return (
    <section className="section company" aria-labelledby="company-title">
      <div className="container company__grid">
        <div className="company__media">
          {playing && video ? (
            video.kind === 'iframe'
              ? <iframe src={video.src} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
              : <video src={video.src} poster={poster ? assetUrl(poster) : undefined} controls autoPlay playsInline />
          ) : (
            <Media src={poster} photo={poster ? undefined : 'sidiBouSaidMosque'} alt="" sizes="(max-width: 900px) 100vw, 50vw">
              {video && (
                <button type="button" className="company__play" onClick={() => setPlaying(true)}>
                  <span className="company__play-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg></span>
                  <span>{t('about.watch')}</span>
                </button>
              )}
            </Media>
          )}
        </div>
        <div className="company__text">
          <span className="eyebrow">{t('about.eyebrow')}</span>
          <h2 id="company-title" className="section__title">{title}</h2>
          {text.split(/\n\s*\n|\n/).filter((p) => p.trim()).map((p, i) => <p key={i}>{p}</p>)}
          {Array.isArray(services) && (
            <ul className="company__services">
              {services.map((x) => (
                <li key={x.key}>
                  <span className="company__icon" aria-hidden="true">{x.key === 'transfers' ? ICONS.car : ICONS.compass}</span>
                  <div>
                    <h3>{x.title}</h3>
                    <p>{x.text}</p>
                    <Link to={path(lang, x.key)}>{x.link} →</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {stats.length > 0 && (
            <dl className="company__stats">
              {stats.slice(0, 4).map((s, i) => <div key={i}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
            </dl>
          )}
          <Link to={path(lang, 'contact')} className="btn btn--outline btn--lg">{t('about.cta')}</Link>
        </div>
      </div>
    </section>
  );
}
