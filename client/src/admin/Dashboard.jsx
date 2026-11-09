import { Link } from 'react-router-dom';
import { adminApi } from '../api.js';
import { useLoad, Top, eur, Status, Err } from './shared.jsx';

function DayList({ title, list }) {
  return (
    <section className="panel stack">
      <h2 style={{ fontSize: 18 }}>{title} <span className="tag">{list.length}</span></h2>
      {list.length === 0 && <p className="muted">Aucune prestation.</p>}
      {list.map((b) => (
        <Link key={b._id} to={`/admin/bookings?open=${b._id}`} className="row" style={{ justifyContent: 'space-between', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
          <span><strong>{b.ref}</strong> · {b.customer.name}<br /><small className="muted">{b.items.map((i) => `${i.time || ''} ${i.title}`).join(' · ')}</small></span>
          <Status s={b.status} />
        </Link>
      ))}
    </section>
  );
}

export default function Dashboard() {
  const { data, error } = useLoad(() => adminApi.get('/dashboard'));
  if (error) return <Err error={error} />;
  if (!data) return <p>Chargement…</p>;
  const r = data.revenueMonth;
  return (
    <>
      <Top title="Tableau de bord" />
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="panel kpi"><strong>{data.today.length}</strong><span>prestations aujourd'hui</span></div>
        <div className="panel kpi"><strong>{data.toConfirm.length}</strong><span>demandes à confirmer</span></div>
        <div className="panel kpi"><strong>{eur(r.expected)}</strong><span>CA prévu ce mois ({r.count} réservations)</span></div>
        <div className="panel kpi"><strong>{eur(r.collected)}</strong><span>encaissé ce mois</span></div>
      </div>
      {data.alerts.length > 0 && (
        <section className="panel stack" style={{ marginBottom: 16, borderColor: '#F59E0B' }}>
          <h2 style={{ fontSize: 18 }}>Alertes</h2>
          {data.alerts.map((a, i) => (
            <Link key={i} to={`/admin/bookings?open=${a.id}`} className="alert alert--warn" style={{ textDecoration: 'none' }}>
              {a.type === 'unconfirmed' ? 'Réservation non confirmée depuis plus de 6 h' : 'Chauffeur non attribué'} · {a.ref}
            </Link>
          ))}
        </section>
      )}
      <div className="grid-3">
        <DayList title="À confirmer" list={data.toConfirm} />
        <DayList title="Aujourd'hui" list={data.today} />
        <DayList title="Demain" list={data.tomorrow} />
      </div>
    </>
  );
}
