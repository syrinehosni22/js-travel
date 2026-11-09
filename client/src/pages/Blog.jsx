import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp, useFetch } from '../context.jsx';
import { LANGS, path } from '../i18n.js';
import { Seo, Media, Loading, ErrorBox } from '../components/ui.jsx';
import NotFound from './NotFound.jsx';

export function Blog() {
  const { t } = useTranslation();
  const { lang } = useApp();
  const { data, loading } = useFetch(() => api.get('/posts', { lang }), [lang]);
  return (
    <>
      <Seo title={t('nav.blog')} alternates={Object.fromEntries(LANGS.map((l) => [l, path(l, 'blog')]))} />
      <div className="page-head"><div className="container"><h1>{t('home.blogTitle')}</h1></div></div>
      <div className="container section">
        {loading && <Loading />}
        <div className="blog-grid">{(data || []).map((p) => (
          <article className="post" key={p.id}>
            <Media src={p.image} alt={p.imageAlt} ph="#C7D8EA" />
            <div className="post__meta">{p.publishedAt?.slice(0, 10)} · {p.category}</div>
            <h3><Link to={path(lang, 'blog', p.slug)}>{p.title}</Link></h3>
            <p className="muted">{p.excerpt}</p>
          </article>
        ))}</div>
      </div>
    </>
  );
}

/** Article avec boutons de partage sur les réseaux sociaux */
export function BlogPost() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const { lang } = useApp();
  const { data: p, loading, error } = useFetch(() => api.get(`/posts/${encodeURIComponent(slug)}`, { lang }), [slug, lang]);
  if (loading) return <Loading />;
  if (error?.status === 404) return <NotFound />;
  if (error) return <ErrorBox error={error} />;
  const url = encodeURIComponent(window.location.href);
  return (
    <>
      <Seo title={p.seo?.metaTitle || p.title} description={p.seo?.metaDescription || p.excerpt} image={p.image}
        alternates={Object.fromEntries(LANGS.filter((l) => p.slugs?.[l]).map((l) => [l, path(l, 'blog', p.slugs[l])]))}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, image: p.image, datePublished: p.publishedAt }} />
      <article className="container section prose">
        <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 20 }}>{p.seo?.h1 || p.title}</h1>
        {p.image && <Media src={p.image} alt={p.imageAlt} style={{ height: 360, borderRadius: 22, marginBottom: 24 }} />}
        {/* Contenu saisi par l'équipe dans l'admin (rédacteurs de confiance) */}
        <div dangerouslySetInnerHTML={{ __html: p.body }} />
        <div className="row" style={{ marginTop: 32 }} aria-label={t('common.share')}>
          <a className="btn btn--outline" href={`https://www.facebook.com/sharer/sharer.php?u=${url}`} target="_blank" rel="noopener noreferrer">Facebook</a>
          <a className="btn btn--outline" href={`https://wa.me/?text=${url}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className="btn btn--outline" href={`https://twitter.com/intent/tweet?url=${url}`} target="_blank" rel="noopener noreferrer">X</a>
        </div>
      </article>
    </>
  );
}
