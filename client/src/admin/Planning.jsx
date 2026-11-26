import { useState } from 'react';
import { adminApi } from '../api.js';
import { useAdmin } from './AdminApp.jsx';
import { useLoad, Top, Status, useToast, useConfirm } from './shared.jsx';

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
  const confirm = useConfirm();
  const [sent, setSent] = useState(null);   // résultat de l'envoi des feuilles de route
  const dateLabel = (d) => new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  async function sendRoadmaps() {
    const ok = await confirm({
      title: `Envoyer les feuilles de route du ${dateLabel(start)} ?`,
      message: 'Chaque chauffeur qui a au moins une prestation ce jour-là reçoit sur WhatsApp la liste de ses prestations : heure, excursion ou trajet, client, nombre de personnes, hôtel et téléphone du client.',
      confirmLabel: 'Envoyer', danger: false,
    });
    if (!ok) return;
    setSent({ busy: true });
    try { setSent(await adminApi.post('/planning/roadmaps', { date: start })); } catch (x) { setSent({ error: x.message }); }
  }

  async function assign(row, driverId) {
    await adminApi.patch(`/bookings/${row._id}`, { items: [{ _id: row.item._id, driver: driverId || null }] });
    say('Chauffeur attribué'); reload();
  }
  async function assignVehicle(row, vehicleId) {
    await adminApi.patch(`/bookings/${row._id}`, { items: [{ _id: row.item._id, vehicle: vehicleId || null }] });
    say('Véhicule choisi'); reload();
  }
  const vehicles = data?.vehicles || [];
  const vehicleName = (id) => { const v = vehicles.find((x) => String(x._id) === String(id)); return v ? `${v.label}${v.plate ? ` (${v.plate})` : ''}` : ''; };
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
        {!isDriver && <button className="btn btn--green btn-sm" disabled={sent?.busy} onClick={sendRoadmaps}>{sent?.busy ? 'Envoi…' : 'Envoyer les feuilles de route WhatsApp'}</button>}
      </Top>

      {!isDriver && (
        <details className="panel" style={{ marginBottom: 16 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Comment utiliser « Envoyer les feuilles de route WhatsApp » ?</summary>
          <ol style={{ margin: '10px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Créez vos chauffeurs et vos véhicules dans le menu <b>Chauffeurs et véhicules</b>.</li>
            <li>Choisissez le <b>jour</b> avec le calendrier ci-dessus (souvent la veille au soir : la date de demain).</li>
            <li>Pour chaque prestation, choisissez le <b>chauffeur</b> et le <b>véhicule</b> dans le tableau (ou glissez la ligne sur la carte du chauffeur).</li>
            <li>Cliquez sur <b>Envoyer les feuilles de route WhatsApp</b> : chaque chauffeur qui a des prestations ce jour-là reçoit un message avec l’heure, l’excursion ou le trajet, le client, le nombre de personnes, l’hôtel, le téléphone du client et le véhicule.</li>
            <li>Le résultat s’affiche ici. Si l’envoi automatique échoue (WhatsApp de l’API non configuré, numéro non autorisé…), un bouton <b>Ouvrir WhatsApp</b> prépare le message pour l’envoyer vous-même.</li>
          </ol>
        </details>
      )}

      {sent && !sent.busy && (
        <div className="panel stack" style={{ marginBottom: 16, gap: 8 }} role="status">
          {sent.error && <p className="alert alert--warn" style={{ margin: 0 }}>Échec : {sent.error}</p>}
          {sent.results && sent.results.length === 0 && <p className="alert alert--warn" style={{ margin: 0 }}>Aucun chauffeur n’a de prestation le {dateLabel(sent.date)}. Affectez d’abord les chauffeurs aux prestations.</p>}
          {sent.results?.map((r) => (
            <div key={r.driver} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{r.ok ? '✓' : '✗'} <b>{r.driver}</b> · {r.count} prestation(s) · {r.ok ? 'envoyée par WhatsApp' : `non envoyée — ${r.error || 'erreur'}`}</span>
              {!r.ok && r.phone && <a className="btn btn--whatsapp btn-sm" href={`https://wa.me/${r.phone.replace(/\D/g, '')}?text=${encodeURIComponent(r.text)}`} target="_blank" rel="noreferrer">Ouvrir WhatsApp</a>}
            </div>
          ))}
        </div>
      )}

      {!isDriver && drivers.length > 0 && (
        <div className="row" style={{ marginBottom: 16 }}>
          {drivers.map((d) => (
            <div key={d._id} className="panel" style={{ minWidth: 160 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const row = items.find((x) => x.item._id === e.dataTransfer.getData('text')); if (row) assign(row, d._id); }}>
              <strong>{d.name}</strong><br /><small className="muted">{d.phone}</small><br />
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
            <thead><tr><th>Heure</th><th>Prestation</th><th>Client</th><th>Prise en charge</th><th>Pers.</th>{!isDriver && <th>Chauffeur</th>}<th>Véhicule</th><th>Statut</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.item._id} draggable={!isDriver} onDragStart={(e) => e.dataTransfer.setData('text', r.item._id)} style={{ cursor: isDriver ? 'default' : 'grab' }}>
                <td>{r.item.time || '—'}</td>
                <td><strong>{r.item.title}</strong><br /><small className="muted">{r.ref}</small></td>
                <td>{r.customer.name}<br /><a href={`https://wa.me/${(r.customer.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{r.customer.phone}</a></td>
                <td>{r.item.transfer ? `${r.item.transfer.from}${r.item.transfer.flightNumber ? ` (vol ${r.item.transfer.flightNumber})` : ''}` : `${r.customer.hotel || ''} ${r.item.zone ? `· ${r.item.zone}` : ''}`}</td>
                <td>{(r.item.participants?.adult || 0) + (r.item.participants?.child || 0) + (r.item.participants?.infant || 0)}</td>
                {!isDriver && <td><select value={r.item.driver || ''} onChange={(e) => assign(r, e.target.value)} aria-label="Chauffeur"><option value="">—</option>{drivers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></td>}
                <td>{isDriver ? (vehicleName(r.item.vehicle) || '—') : (
                  <select value={r.item.vehicle || ''} onChange={(e) => assignVehicle(r, e.target.value)} aria-label="Véhicule"><option value="">—</option>{vehicles.map((v) => <option key={v._id} value={v._id}>{v.label}{v.plate ? ` · ${v.plate}` : ''}{v.capacity ? ` (${v.capacity} pl.)` : ''}</option>)}</select>
                )}</td>
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
