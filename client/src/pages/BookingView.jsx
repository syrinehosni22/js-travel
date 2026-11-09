import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp, useFetch } from '../context.jsx';
import { Seo, Loading, ErrorBox, PriceLines } from '../components/ui.jsx';

/** Confirmation (§5.3) et espace client sans mot de passe (§5.5) */
export default function BookingView() {
  const { t } = useTranslation();
  const { ref } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token');
  const isNew = params.get('new') === '1';
  const { lang, money } = useApp();
  const { data: b, loading, error } = useFetch(() => api.get(`/bookings/${ref}?token=${token}`), [ref, token]);

  async function cancel() {
    if (!window.confirm(t('confirm.cancelConfirm'))) return;
    await api.post(`/bookings/${ref}/cancel?token=${token}`);
    window.location.reload();
  }

  if (loading) return <Loading />;
  if (error) return <div className="container" style={{ padding: 48 }}><ErrorBox error={error} /></div>;
  const base = `/api/bookings/${ref}`;
  return (
    <>
      <Seo title={`${t('confirm.title')} ${ref}`} noindex />
      <div className="page-head"><div className="container">
        <h1>{isNew ? t('confirm.title') : t('confirm.manage')}</h1>
        {isNew && <p>{b.status === 'confirmed' ? t('confirm.confirmed', { ref }) : t('confirm.received', { ref })} {t('confirm.email')}</p>}
      </div></div>
      <div className="container cart">
        <div className="stack">
          <div className="row"><strong>{t('confirm.status')}{lang === 'fr' ? ' :' : ':'}</strong> <span className="tag">{t(`confirm.statuses.${b.status}`)}</span></div>
          {b.items.map((i) => (
            <div key={i._id} className="card stack" style={{ gap: 8 }}>
              <strong>{i.title}</strong>
              <span className="muted">{i.date} {i.time || ''} · {i.participants?.adult} {t('price.adult')}{i.participants?.child ? `, ${i.participants.child} ${t('price.child')}` : ''}</span>
              <PriceLines lines={i.lines} />
            </div>
          ))}
        </div>
        <aside className="card stack">
          <div className="row" style={{ justifyContent: 'space-between' }}><strong>{t('price.total')}</strong><strong className="price">{money(b.totalEur, 2)}</strong></div>
          <small className="muted">{t('price.payOnSite')}</small>
          {b.status !== 'cancelled' && <>
            <a className="btn btn--green" href={`${base}/voucher.pdf?token=${token}`} target="_blank" rel="noopener noreferrer">{t('confirm.voucher')}</a>
            <a className="btn btn--outline" href={`${base}/calendar.ics?token=${token}`}>{t('confirm.calendar')}</a>
          </>}
          {b.canCancel && <button className="link-btn" onClick={cancel}>{t('confirm.cancel')}</button>}
        </aside>
      </div>
    </>
  );
}
