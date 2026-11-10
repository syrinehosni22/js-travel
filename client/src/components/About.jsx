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

  return (
    <section className="section about" aria-labelledby="about-title">
      <div className="container about__grid">
        <div className="about__media">
          {playing && video ? (
            video.kind === 'iframe'
              ? <iframe src={video.src} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
              : <video src={video.src} poster={poster ? assetUrl(poster) : undefined} controls autoPlay playsInline />
          ) : (
            <Media src={poster} photo={poster ? undefined : 'sidiBouSaidMosque'} alt="" sizes="(max-width: 900px) 100vw, 50vw">
              {video && (
                <button type="button" className="about__play" onClick={() => setPlaying(true)}>
                  <span className="about__play-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg></span>
                  <span>{t('about.watch')}</span>
                </button>
              )}
            </Media>
          )}
        </div>
        <div className="about__text">
          <span className="eyebrow">{t('about.eyebrow')}</span>
          <h2 id="about-title" className="section__title">{title}</h2>
          {text.split(/\n\s*\n|\n/).filter((p) => p.trim()).map((p, i) => <p key={i}>{p}</p>)}
          {stats.length > 0 && (
            <dl className="about__stats">
              {stats.slice(0, 4).map((s, i) => <div key={i}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
            </dl>
          )}
          <Link to={path(lang, 'contact')} className="btn btn--outline btn--lg">{t('about.cta')}</Link>
        </div>
      </div>
    </section>
  );
}
