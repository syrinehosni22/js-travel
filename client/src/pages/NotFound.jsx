import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context.jsx';
import { api } from '../api.js';
import { Seo } from '../components/ui.jsx';

export default function NotFound() {
  const { t } = useTranslation();
  const { lang } = useApp();
  const loc = useLocation();
  const nav = useNavigate();

  // Ancienne adresse (excursion renommée ou supprimée) : l'API indique la nouvelle
  useEffect(() => {
    let alive = true;
    api.get(`/redirect?path=${encodeURIComponent(loc.pathname)}`)
      .then((r) => { if (alive && r?.to && r.to !== loc.pathname) nav(r.to, { replace: true }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [loc.pathname, nav]);

  return (
    <div className="container section" style={{ textAlign: 'center' }}>
      <Seo title={t('common.notFound')} noindex />
      <h1 style={{ fontSize: 40, fontWeight: 800 }}>404</h1>
      <p className="muted" style={{ margin: '12px 0 24px' }}>{t('common.notFound')}</p>
      <Link to={`/${lang}`} className="btn btn--green">{t('common.back')}</Link>
    </div>
  );
}
