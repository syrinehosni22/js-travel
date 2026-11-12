import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi, adminDownload, API_URL } from '../api.js';
import { useAdmin } from './AdminApp.jsx';
import { useLoad, Top, eur, Status, STATUS, Err, useToast, useConfirm } from './shared.jsx';

/** Suppression d'une réservation (définitive) avec confirmation */
function useDeleteBooking() {
  const confirm = useConfirm();
  return async (b) => {
    const ok = await confirm({
      title: `Supprimer la réservation ${b.ref} ?`,
      message: `Réservation de ${b.customer?.name || 'ce client'} (${eur(b.totalEur)}). Elle disparaîtra du planning, des rapports et de l’espace client. Pour garder une trace, préférez le statut « Annulée ».`,
      confirmLabel: 'Supprimer la réservation',
    });
    if (!ok) return false;
    await adminApi.del(`/bookings/${b._id}`);
    return true;
  };
}

/** Fiche détaillée : statut, montant encaissé, renvoi des bons (§7.1) */
function BookingDrawer({ id, onClose, onSaved }) {
  const { data: b, reload, error } = useLoad(() => adminApi.get(`/bookings/${id}`), [id]);
  const [toast, say] = useToast();
  const [collected, setCollected] = useState('');
  useEffect(() => { if (b) setCollected(b.collectedAmount ?? b.totalEur); }, [b]);
  const { user } = useAdmin();
  const canEdit = ['admin', 'manager'].includes(user.role);
  const confirm = useConfirm();
  const removeBooking = useDeleteBooking();
  const [cust, setCust] = useState(null);
  const [err, setErr] = useState(null);

  async function patch(body, msg) {
    setErr(null);
    try { await adminApi.patch(`/bookings/${id}`, body); say(msg || 'Enregistré'); reload(); onSaved(); return true; }
    catch (x) { setErr(x); return false; }
  }
  async function setStatus(s) {
    if (s === 'cancelled' && !(await confirm({ title: `Annuler la réservation ${b.ref} ?`, message: 'Le client est prévenu par e-mail et WhatsApp. La réservation reste visible avec le statut « Annulée ».', confirmLabel: 'Annuler la réservation' }))) return;
    if (s === 'no_show' && !(await confirm({ title: 'Marquer le client absent ?', message: 'Après plusieurs absences, le client peut être bloqué automatiquement.', confirmLabel: 'Marquer absent', danger: false }))) return;
    patch({ status: s }, `Statut : ${STATUS[s]}`);
  }
  if (error) return <div className="drawer"><Err error={error} /></div>;
  if (!b) return <div className="drawer">Chargement…</div>;
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside className="drawer stack" aria-label={`Réservation ${b.ref}`}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{b.ref} <Status s={b.status} /></h2>
          <button className="btn btn--outline btn-sm" onClick={onClose}>Fermer</button>
        </div>
        <Err error={err} />
        {cust ? (
          <form className="panel stack" onSubmit={async (e) => { e.preventDefault(); if (await patch({ customer: cust }, 'Coordonnées modifiées')) setCust(null); }}>
            <strong>Modifier les coordonnées</strong>
            <div className="grid-2">
              <label className="lbl">Nom<input className="inp" required value={cust.name || ''} onChange={(e) => setCust({ ...cust, name: e.target.value })} /></label>
              <label className="lbl">E-mail<input className="inp" type="email" required value={cust.email || ''} onChange={(e) => setCust({ ...cust, email: e.target.value })} /></label>
              <label className="lbl">Téléphone<input className="inp" required value={cust.phone || ''} onChange={(e) => setCust({ ...cust, phone: e.target.value })} /></label>
              <label className="lbl">Hôtel<input className="inp" value={cust.hotel || ''} onChange={(e) => setCust({ ...cust, hotel: e.target.value })} /></label>
              <label className="lbl">Chambre<input className="inp" value={cust.room || ''} onChange={(e) => setCust({ ...cust, room: e.target.value })} /></label>
            </div>
            <label className="lbl">Remarques<textarea className="inp" rows={3} value={cust.notes || ''} onChange={(e) => setCust({ ...cust, notes: e.target.value })} /></label>
            <div className="row"><button className="btn btn--green btn-sm">Enregistrer</button><button type="button" className="btn btn--outline btn-sm" onClick={() => setCust(null)}>Annuler</button></div>
          </form>
        ) : (
        <div className="panel">
          {canEdit && <button type="button" className="btn btn--outline btn-sm" style={{ float: 'right' }} onClick={() => setCust({ name: b.customer.name, email: b.customer.email, phone: b.customer.phone, hotel: b.customer.hotel || '', room: b.customer.room || '', notes: b.customer.notes || '' })}>Modifier</button>}
          <strong>{b.customer.name}</strong><br />
          <a href={`mailto:${b.customer.email}`}>{b.customer.email}</a> · <a href={`https://wa.me/${(b.customer.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{b.customer.phone}</a><br />
          {b.customer.hotel} {b.customer.room && `· ch. ${b.customer.room}`}
          {b.customer.notes && <p className="muted" style={{ marginTop: 8 }}>« {b.customer.notes} »</p>}
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Langue {b.lang?.toUpperCase()} · {b.channel} {b.promoCode && `· code ${b.promoCode}`}</p>
        </div>
        )}
        {b.items.map((i) => (
          <div key={i._id} className="panel stack" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><strong>{i.title}</strong><span>{eur(i.totalEur)}</span></div>
            <span className="muted">{i.date} {i.time} · {i.participants?.adult} ad. {i.participants?.child ? `+ ${i.participants.child} enf.` : ''} {i.participants?.infant ? `+ ${i.participants.infant} bébé` : ''} {i.zone && `· ${i.zone}`} {i.guideLang && `· guide ${i.guideLang.toUpperCase()}`}</span>
            {i.transfer && <span className="muted">{i.transfer.from} → {i.transfer.to} · {i.transfer.vehicle} {i.transfer.flightNumber && `· vol ${i.transfer.flightNumber}`}</span>}
            {i.options?.length > 0 && <span className="muted">Options : {i.options.join(', ')}</span>}
            {canEdit && (
              <label className="lbl" style={{ maxWidth: 220 }}>Date<input className="inp" type="date" defaultValue={i.date} onBlur={(e) => e.target.value !== i.date && patch({ items: [{ _id: i._id, date: e.target.value }] })} /></label>
            )}
          </div>
        ))}
        <div className="panel row" style={{ justifyContent: 'space-between' }}><strong>Total à régler sur place</strong><strong>{eur(b.totalEur)}</strong></div>
        {canEdit && <>
          <div className="row">
            {['confirmed', 'paid_on_site', 'completed', 'no_show', 'cancelled'].map((s) => (
              <button key={s} className={`btn btn-sm ${s === 'cancelled' || s === 'no_show' ? 'btn--outline' : 'btn--green'}`} disabled={b.status === s}
                onClick={() => setStatus(s)}>{STATUS[s]}</button>
            ))}
          </div>
          <form className="row" onSubmit={(e) => { e.preventDefault(); patch({ collectedAmount: +collected, status: b.status === 'confirmed' ? 'paid_on_site' : undefined }, 'Montant encaissé enregistré'); }}>
            <label className="lbl" style={{ flex: 1 }}>Montant encaissé (EUR)<input className="inp" type="number" step="0.01" value={collected} onChange={(e) => setCollected(e.target.value)} /></label>
            <button className="btn btn--green btn-sm" style={{ alignSelf: 'flex-end' }}>Enregistrer</button>
          </form>
          <div className="row">
            <button className="btn btn--outline btn-sm" onClick={() => adminApi.post(`/bookings/${id}/resend`).then(() => say('Bon renvoyé'))}>Renvoyer le bon</button>
            <a className="btn btn--outline btn-sm" href={`${API_URL}/api/bookings/${b.ref}/voucher.pdf?token=${b.token}`} target="_blank" rel="noreferrer">Voir le PDF</a>
          </div>
        </>}
        {canEdit && (
          <div className="panel danger-zone row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Supprimer définitivement cette réservation</span>
            <button type="button" className="btn btn--danger-outline btn-sm" onClick={async () => { if (await removeBooking(b)) { onSaved(); onClose(); } }}>Supprimer</button>
          </div>
        )}
        <details><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Historique</summary>
          <ul className="muted" style={{ fontSize: 13 }}>{b.history.map((h, k) => <li key={k}>{new Date(h.at).toLocaleString('fr-FR')} · {h.by} · {h.action} {h.note}</li>)}</ul>
        </details>
        {toast}
      </aside>
    </>
  );
}

export default function Bookings() {
  const [params, setParams] = useSearchParams();
  const [f, setF] = useState({ status: '', from: '', to: '', q: params.get('q') || '' });
  const [sel, setSel] = useState([]);
  const [open, setOpen] = useState(params.get('open'));
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem('tt_filters') || '[]'); } catch { return []; } });
  const query = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data, error, reload } = useLoad(() => adminApi.get(`/bookings?${query}`), [query]);
  useEffect(() => { setF((x) => ({ ...x, q: params.get('q') || '' })); setOpen(params.get('open')); }, [params]);

  const bulk = async (status) => { await adminApi.post('/bookings/bulk', { ids: sel, status }); setSel([]); reload(); };
  const removeBooking = useDeleteBooking();
  const [toast, say] = useToast();
  const { user } = useAdmin();
  const canEdit = ['admin', 'manager'].includes(user.role);
  const saveFilter = () => {
    const name = window.prompt('Nom du filtre');
    if (!name) return;
    const next = [...saved, { name, f }]; setSaved(next); localStorage.setItem('tt_filters', JSON.stringify(next));
  };
  return (
    <>
      <Top title="Réservations">
        <button className="btn btn--outline btn-sm" onClick={() => adminDownload(`/bookings/export.csv?${query}`, 'reservations.csv')}>Export CSV / Excel</button>
      </Top>
      <div className="panel row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <label className="lbl">Statut<select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Tous</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="lbl">Du<input className="inp" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="lbl">Au<input className="inp" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label className="lbl" style={{ flex: 1 }}>Recherche<input className="inp" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Nom, e-mail, téléphone, n°" /></label>
        <button className="btn btn--outline btn-sm" onClick={saveFilter}>Enregistrer le filtre</button>
        {saved.map((s, i) => <button key={i} className="chip" onClick={() => setF(s.f)}>{s.name}</button>)}
      </div>
      {sel.length > 0 && (
        <div className="panel row" style={{ marginBottom: 12 }}>
          <strong>{sel.length} sélectionnée(s)</strong>
          <button className="btn btn--green btn-sm" onClick={() => bulk('confirmed')}>Confirmer</button>
          <button className="btn btn--outline btn-sm" onClick={() => bulk('completed')}>Marquer terminées</button>
        </div>
      )}
      <Err error={error} />
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th><input type="checkbox" aria-label="Tout sélectionner" onChange={(e) => setSel(e.target.checked ? (data?.items || []).map((b) => b._id) : [])} /></th><th>N°</th><th>Date</th><th>Client</th><th>Prestations</th><th>Total</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {(data?.items || []).map((b) => (
              <tr key={b._id} onClick={() => setOpen(b._id)} style={{ cursor: 'pointer' }}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Sélectionner ${b.ref}`} checked={sel.includes(b._id)} onChange={(e) => setSel(e.target.checked ? [...sel, b._id] : sel.filter((x) => x !== b._id))} /></td>
                <td><strong>{b.ref}</strong></td>
                <td>{b.firstServiceDate}</td>
                <td>{b.customer.name}<br /><small className="muted">{b.customer.phone}</small></td>
                <td>{b.items.map((i) => i.title).join(' + ')}</td>
                <td>{eur(b.totalEur)}</td>
                <td><Status s={b.status} /></td>
                <td onClick={(e) => e.stopPropagation()}><div className="actions">
                  <button className="btn btn--outline btn-sm" onClick={() => setOpen(b._id)}>Modifier</button>
                  {canEdit && <button className="btn btn--danger-outline btn-sm" onClick={async () => { if (await removeBooking(b)) { reload(); say(`Réservation ${b.ref} supprimée`); } }}>Supprimer</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 8 }}>{data?.total ?? 0} réservation(s)</p>
      </div>
      {toast}
      {open && <BookingDrawer id={open} onClose={() => { setOpen(null); params.delete('open'); setParams(params, { replace: true }); }} onSaved={reload} />}
    </>
  );
}
