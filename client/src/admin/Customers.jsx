import { useState } from 'react';
import { adminApi, adminDownload } from '../api.js';
import { useLoad, Top, eur, Err, useConfirm, useToast } from './shared.jsx';

/** Clients : historique, blocage des absents à répétition, export, suppression RGPD */
export default function Customers() {
  const [q, setQ] = useState('');
  const { data, error, reload } = useLoad(() => adminApi.get(`/customers?q=${encodeURIComponent(q)}`), [q]);
  const confirm = useConfirm();
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState(null);
  const [toast, say] = useToast();
  async function saveEdit(e) {
    e.preventDefault(); setErr(null);
    try { await adminApi.patch(`/customers/${encodeURIComponent(edit.email)}`, { name: edit.name, phone: edit.phone || '' }); setEdit(null); reload(); say('Client modifié'); } catch (x) { setErr(x); }
  }
  async function gdpr(c) {
    const ok = await confirm({ title: `Supprimer les données de ${c.name} ?`, message: `Nom, e-mail, téléphone et hôtel de ${c.email} seront effacés de toutes ses réservations (droit à l’effacement RGPD). Les montants restent dans les rapports.`, confirmLabel: 'Supprimer les données' });
    if (!ok) return;
    try { await adminApi.del(`/customers/${encodeURIComponent(c.email)}`); reload(); say('Données du client supprimées'); } catch (x) { setErr(x); }
  }
  return (
    <>
      <Top title="Clients"><button className="btn btn--outline btn-sm" onClick={() => adminDownload('/bookings/export.csv', 'clients-reservations.csv')}>Export CSV</button></Top>
      <input className="inp" style={{ marginBottom: 12, width: '100%', maxWidth: 420 }} placeholder="Rechercher un client" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un client" />
      <Err error={error || err} />
      {edit && (
        <form className="panel stack" style={{ marginBottom: 12 }} onSubmit={saveEdit}>
          <h3>Modifier le client · <small className="muted">{edit.email}</small></h3>
          <div className="grid-2">
            <label className="lbl">Nom<input className="inp" required value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="lbl">Téléphone<input className="inp" value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></label>
          </div>
          <small className="muted">Les corrections s’appliquent aussi à ses réservations.</small>
          <div className="row"><button className="btn btn--green">Enregistrer</button><button type="button" className="btn btn--outline" onClick={() => setEdit(null)}>Annuler</button></div>
        </form>
      )}
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Client</th><th>Téléphone</th><th>Réservations</th><th>Total</th><th>Dernière date</th><th>Absences</th><th></th></tr></thead>
          <tbody>{(data || []).map((c) => (
            <tr key={c.email}>
              <td>{c.name}<br /><small className="muted">{c.email}</small></td>
              <td>{c.phone}</td><td>{c.bookings}</td><td>{eur(c.total)}</td><td>{c.last}</td>
              <td>{c.noShowCount}{c.blocked && <span className="st st-cancelled" style={{ marginLeft: 6 }}>bloqué</span>}</td>
              <td><div className="actions">
                <button className="btn btn--outline btn-sm" onClick={() => { setEdit({ email: c.email, name: c.name, phone: c.phone }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Modifier</button>
                <button className="btn btn--outline btn-sm" onClick={() => adminApi.patch(`/customers/${encodeURIComponent(c.email)}`, { blocked: !c.blocked }).then(reload)}>{c.blocked ? 'Débloquer' : 'Bloquer'}</button>
                <button className="btn btn--danger-outline btn-sm" onClick={() => gdpr(c)}>Supprimer</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {toast}
    </>
  );
}
