import { useState } from 'react';
import { adminApi, adminDownload } from '../api.js';
import { useAdmin } from './AdminApp.jsx';
import { useLoad, Top, eur, Err } from './shared.jsx';

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
      <section className="panel tbl-wrap">
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Commissions partenaires (réservations réglées)</h2>
        <table className="tbl"><thead><tr><th>Partenaire</th><th>Réservations</th><th>CA</th><th>Commission</th></tr></thead>
          <tbody>{(partners.data || []).map((p) => <tr key={p._id}><td>{p.name}</td><td>{p.bookings}</td><td>{eur(p.revenue)}</td><td>{eur(p.commission)}</td></tr>)}</tbody></table>
      </section>
    </>
  );
}
