import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp, useFetch } from '../context.jsx';
import { Seo, Loading } from '../components/ui.jsx';
import NotFound from './NotFound.jsx';

const TITLES = { privacy: 'footer.privacy', cancellation: 'footer.cancellation', terms: 'footer.terms' };

export default function Legal() {
  const { t } = useTranslation();
  const { key } = useParams();
  const { lang } = useApp();
  const { data, loading, error } = useFetch(() => api.get(`/legal/${key}`, { lang }), [key, lang]);
  if (!TITLES[key] || error) return <NotFound />;
  if (loading) return <Loading />;
  return (
    <>
      <Seo title={t(TITLES[key])} />
      <div className="page-head"><div className="container"><h1>{t(TITLES[key])}</h1></div></div>
      <div className="container section prose">{data.body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div>
    </>
  );
}
