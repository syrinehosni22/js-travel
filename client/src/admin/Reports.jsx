import { useState } from 'react';
import { adminApi, adminDownload } from '../api.js';
import { useAdmin } from './AdminApp.jsx';
import { useLoad, Top, eur, Err } from './shared.jsx';

const STATUS_FR = { paid_on_site: 'Réglée sur place', completed: 'Terminée' };
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 12).toISOString().slice(0, 10); };

/** Commission (Syrine par défaut) sur les réservations abouties = réglées sur place ou terminées */
function CommissionPanel() {
  const [f, setF] = useState({ from: monthStart(), to: new Date().toISOString().slice(0, 10), percent: '' });
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '')).toString();
  const { data, error } = useLoad(() => adminApi.get(`/reports/commission?${q}`), [q]);
  const name = data?.name || 'Syrine';
  return (
    <section className="panel stack" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18 }}>Commission de {name}</h2>
        <button type="button" className="btn btn--green btn-sm" disabled={!data} onClick={() => adminDownload(`/reports/commission?${q}&format=xlsx`, `commission-${name.toLowerCase()}-${f.from}-${f.to}.xlsx`)}>Télécharger le fichier Excel</button>
      </div>
      <p className="muted" style={{ margin: 0 }}>Réservations abouties : <b>réglées sur place</b> ou <b>terminées</b>, selon la date de la prestation. Base : le montant encaissé saisi dans la réservation, sinon le total.</p>
      <div className="row" style={{ alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <label className="lbl">Du<input className="inp" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="lbl">Au<input className="inp" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label className="lbl" style={{ width: 140 }}>Taux (%)<input className="inp" type="number" min="0" max="100" step="0.5" placeholder={data ? String(data.percent) : ''} value={f.percent} onChange={(e) => setF({ ...f, percent: e.target.value })} /></label>
        <small className="muted" style={{ paddingBottom: 10 }}>Taux par défaut réglable dans Paramètres.</small>
      </div>
      <Err error={error} />
      {data && (
        <>
          <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
            <div><small className="muted">Réservations</small><div style={{ fontSize: 22, fontWeight: 700 }}>{data.rows.length}</div></div>
            <div><small className="muted">Montant réglé</small><div style={{ fontSize: 22, fontWeight: 700 }}>{eur(data.total)}</div></div>
            <div><small className="muted">Commission de {name} ({data.percent} %)</small><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{eur(data.commission)}</div></div>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Réservation</th><th>Date</th><th>Client</th><th>Prestations</th><th>Statut</th><th>Montant réglé</th><th>Commission</th></tr></thead>
              <tbody>
                {data.rows.length === 0 && <tr><td colSpan={7} className="muted">Aucune réservation réglée sur cette période.</td></tr>}
                {data.rows.map((r) => <tr key={r.ref}><td>{r.ref}</td><td>{r.date}</td><td>{r.customer}</td><td>{r.items}</td><td>{STATUS_FR[r.status] || r.status}</td><td>{eur(r.base)}</td><td><b>{eur(r.commission)}</b></td></tr>)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

/** Ventes par produit, période, langue, canal ; commissions partenaires ; export CSV / Excel */
export default function Reports() {
  const { user } = useAdmin();
  const [f, setF] = useState({ by: 'product', from: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });
  const q = new URLSearchParams(f).toString();
  const sales = useLoad(() => (user.role === 'partner' ? Promise.resolve([]) : adminApi.get(`/reports/sales?${q}`)), [q]);
  const partners = useLoad(() => adminApi.get('/reports/partners'));
  const total = (sales.data || []).reduce((s, r) => s + r.revenue, 0);
  const max = Math.max(1, ...(sales.data || []).map((r) => r.revenue));
  return (
    <>
      <Top title="Rapports">{user.role !== 'partner' && <button className="btn btn--outline btn-sm" onClick={() => adminDownload(`/reports/sales?${q}&format=csv`, 'ventes.csv')}>Export CSV / Excel</button>}</Top>
      {user.role !== 'partner' && <>
        <div className="panel row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
          <label className="lbl">Regrouper par<select className="inp" value={f.by} onChange={(e) => setF({ ...f, by: e.target.value })}><option value="product">Produit</option><option value="month">Mois</option><option value="lang">Langue</option><option value="channel">Canal</option></select></label>
          <label className="lbl">Du<input className="inp" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <label className="lbl">Au<input className="inp" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
          <strong style={{ marginLeft: 'auto' }}>Total : {eur(total)}</strong>
        </div>
        <Err error={sales.error} />
        <div className="panel tbl-wrap" style={{ marginBottom: 16 }}>
          <table className="tbl">
            <thead><tr><th>Groupe</th><th>Réservations</th><th>Personnes</th><th>Chiffre d’affaires</th><th style={{ width: '35%' }}></th></tr></thead>
            <tbody>{(sales.data || []).map((r) => (
              <tr key={r._id}><td>{r._id || '—'}</td><td>{r.bookings}</td><td>{r.people}</td><td>{eur(r.revenue)}</td>
                <td><div aria-hidden="true" style={{ height: 10, borderRadius: 5, background: 'var(--green)', width: `${(r.revenue / max) * 100}%` }} /></td></tr>
            ))}</tbody>
          </table>
        </div>
      </>}
      {user.role !== 'partner' && <CommissionPanel />}
      <section className="panel tbl-wrap">
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Commissions partenaires (réservations réglées)</h2>
        <table className="tbl"><thead><tr><th>Partenaire</th><th>Réservations</th><th>CA</th><th>Commission</th></tr></thead>
          <tbody>{(partners.data || []).map((p) => <tr key={p._id}><td>{p.name}</td><td>{p.bookings}</td><td>{eur(p.revenue)}</td><td>{eur(p.commission)}</td></tr>)}</tbody></table>
      </section>
    </>
  );
}
