import { useState } from 'react';
import { adminApi } from '../api.js';
import { useAdmin } from './AdminApp.jsx';
import { useLoad, Top, Status, useToast } from './shared.jsx';

const iso = (d) => d.toISOString().slice(0, 10);

/**
 * Planning jour / semaine. Glisser une prestation sur un chauffeur pour l'attribuer
 * (glisser-déposer HTML5), ou utiliser le menu déroulant sur mobile (§7.1).
 */
export default function Planning() {
  const { user } = useAdmin();
  const [view, setView] = useState('day');
  const [start, setStart] = useState(iso(new Date()));
  const end = view === 'day' ? start : iso(new Date(new Date(start).getTime() + 6 * 86400000));
  const { data, reload } = useLoad(() => adminApi.get(`/planning?from=${start}&to=${end}`), [start, end]);
  const [toast, say] = useToast();
  const isDriver = user.role === 'driver';

  async function assign(row, driverId) {
    await adminApi.patch(`/bookings/${row._id}`, { items: [{ _id: row.item._id, driver: driverId || null }] });
    say('Chauffeur attribué'); reload();
  }
  const items = data?.items || [];
  const byDate = items.reduce((acc, r) => { (acc[r.item.date] ||= []).push(r); return acc; }, {});
  const drivers = data?.drivers || [];
  const shift = (n) => setStart(iso(new Date(new Date(start).getTime() + n * 86400000)));

  return (
    <>
      <Top title={isDriver ? 'Mon planning' : 'Planning'}>
        <div className="tabs" style={{ margin: 0, border: 0 }}>
          <button aria-selected={view === 'day'} onClick={() => setView('day')}>Jour</button>
          <button aria-selected={view === 'week'} onClick={() => setView('week')}>Semaine</button>
        </div>
        <button className="btn btn--outline btn-sm" onClick={() => shift(view === 'day' ? -1 : -7)}>‹</button>
        <input className="inp" type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Date de début" />
        <button className="btn btn--outline btn-sm" onClick={() => shift(view === 'day' ? 1 : 7)}>›</button>
        {!isDriver && <button className="btn btn--green btn-sm" onClick={() => adminApi.post('/planning/roadmaps', { date: start }).then((r) => say(`Feuilles de route envoyées (${r.sent})`))}>Envoyer les feuilles de route WhatsApp</button>}
      </Top>

      {!isDriver && drivers.length > 0 && (
        <div className="row" style={{ marginBottom: 16 }}>
          {drivers.map((d) => (
            <div key={d._id} className="panel" style={{ minWidth: 160 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const row = items.find((x) => x.item._id === e.dataTransfer.getData('text')); if (row) assign(row, d._id); }}>
              <strong>{d.name}</strong><br /><small className="muted">{d.vehicle?.label} {d.vehicle?.capacity && `· ${d.vehicle.capacity} pl.`}</small><br />
              <small>{items.filter((x) => String(x.item.driver) === String(d._id)).length} prestation(s)</small>
            </div>
          ))}
        </div>
      )}

      {Object.keys(byDate).length === 0 && <p className="panel muted">Aucune prestation sur cette période.</p>}
      {Object.entries(byDate).map(([date, rows]) => (
        <section key={date} className="panel" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>{new Date(date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Heure</th><th>Prestation</th><th>Client</th><th>Prise en charge</th><th>Pers.</th>{!isDriver && <th>Chauffeur</th>}<th>Statut</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.item._id} draggable={!isDriver} onDragStart={(e) => e.dataTransfer.setData('text', r.item._id)} style={{ cursor: isDriver ? 'default' : 'grab' }}>
                <td>{r.item.time || '—'}</td>
                <td><strong>{r.item.title}</strong><br /><small className="muted">{r.ref}</small></td>
                <td>{r.customer.name}<br /><a href={`https://wa.me/${(r.customer.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{r.customer.phone}</a></td>
                <td>{r.item.transfer ? `${r.item.transfer.from}${r.item.transfer.flightNumber ? ` (vol ${r.item.transfer.flightNumber})` : ''}` : `${r.customer.hotel || ''} ${r.item.zone ? `· ${r.item.zone}` : ''}`}</td>
                <td>{(r.item.participants?.adult || 0) + (r.item.participants?.child || 0) + (r.item.participants?.infant || 0)}</td>
                {!isDriver && <td><select value={r.item.driver || ''} onChange={(e) => assign(r, e.target.value)} aria-label="Chauffeur"><option value="">—</option>{drivers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></td>}
                <td><Status s={r.status} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      ))}
      {toast}
    </>
  );
}
