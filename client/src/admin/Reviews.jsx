import { useState } from 'react';
import { adminApi } from '../api.js';
import { useAdmin } from './AdminApp.jsx';
import { useLoad, Top, Err, useToast, useConfirm } from './shared.jsx';

const TABS = [['pending', 'À valider'], ['approved', 'Publiés'], ['rejected', 'Refusés'], ['', 'Tous']];
const LABEL = { pending: 'À valider', approved: 'Publié', rejected: 'Refusé' };
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

/** Modération des avis clients : un avis déposé sur le site n'apparaît qu'une fois publié ici. */
export default function ReviewsAdmin() {
  const { user } = useAdmin();
  const [tab, setTab] = useState('pending');
  const { data, error, loading, reload } = useLoad(() => adminApi.get(`/reviews${tab ? `?status=${tab}` : ''}`), [tab]);
  const [toast, setToast] = useToast();
  const [busy, setBusy] = useState(null);
  const [replies, setReplies] = useState({});
  const [err, setErr] = useState(null);
  const confirm = useConfirm();
  const canDelete = ['admin', 'manager'].includes(user?.role);

  async function update(r, body, msg) {
    setBusy(r._id); setErr(null);
    try { await adminApi.put(`/reviews/${r._id}`, body); setToast(msg); await reload(); }
    catch (x) { setErr(x); }
    setBusy(null);
  }
  async function remove(r) {
    if (!(await confirm({ title: 'Supprimer cet avis ?', message: `L’avis de ${r.name} sera supprimé définitivement.`, confirmLabel: 'Supprimer' }))) return;
    setBusy(r._id);
    try { await adminApi.del(`/reviews/${r._id}`); setToast('Avis supprimé'); await reload(); } catch (x) { setErr(x); }
    setBusy(null);
  }

  const counts = data?.counts || {};
  return (
    <div className="stack">
      <Top title="Avis clients" />
      <p className="muted" style={{ margin: 0 }}>Les avis laissés sur les fiches excursion arrivent ici. Ils ne sont visibles sur le site qu’après avoir été publiés. La note moyenne de l’excursion se met à jour automatiquement.</p>
      <div className="row">
        {TABS.map(([k, label]) => (
          <button key={k || 'all'} type="button" className={`chip${tab === k ? ' chip--on' : ''}`} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {label}{k && counts[k] ? ` (${counts[k]})` : ''}
          </button>
        ))}
      </div>
      <Err error={error || err} />
      {loading && !data && <p>Chargement…</p>}
      {data && data.list.length === 0 && <p className="panel muted">{tab === 'pending' ? 'Aucun avis en attente.' : 'Aucun avis.'}</p>}
      <div className="stack">
        {data?.list.map((r) => {
          const reply = replies[r._id] ?? r.reply ?? '';
          return (
            <article key={r._id} className="panel stack" style={{ gap: 8, opacity: busy === r._id ? 0.6 : 1 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ color: 'var(--gold, #C9A227)', fontSize: 18, letterSpacing: 1 }} aria-label={`${r.rating} sur 5`}>{stars(r.rating)}</span>{' '}
                  <strong>{r.name}</strong>{r.email && <span className="muted"> · {r.email}</span>}
                </div>
                <span className="muted" style={{ fontSize: 13 }}>{r.excursion?.title?.fr || 'Excursion supprimée'} · {new Date(r.createdAt).toLocaleString('fr-FR')} · {LABEL[r.status]}{r.lang ? ` · ${r.lang.toUpperCase()}` : ''}</span>
              </div>
              {r.comment ? <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{r.comment}</p> : <p className="muted" style={{ margin: 0 }}>(note sans commentaire)</p>}
              <label className="lbl">Réponse publique (facultative)
                <textarea className="inp" rows={2} value={reply} onChange={(ev) => setReplies({ ...replies, [r._id]: ev.target.value })} placeholder="Merci pour votre visite !" />
              </label>
              <div className="row">
                {r.status !== 'approved' && <button type="button" className="btn btn--primary btn-sm" disabled={busy === r._id} onClick={() => update(r, { status: 'approved', reply }, 'Avis publié')}>Publier</button>}
                {r.status === 'approved' && reply !== (r.reply || '') && <button type="button" className="btn btn--primary btn-sm" disabled={busy === r._id} onClick={() => update(r, { reply }, 'Réponse enregistrée')}>Enregistrer la réponse</button>}
                {r.status !== 'rejected' && <button type="button" className="btn btn--outline btn-sm" disabled={busy === r._id} onClick={() => update(r, { status: 'rejected' }, r.status === 'approved' ? 'Avis retiré du site' : 'Avis refusé')}>{r.status === 'approved' ? 'Retirer du site' : 'Refuser'}</button>}
                {canDelete && <button type="button" className="btn btn--danger-outline btn-sm" disabled={busy === r._id} onClick={() => remove(r)}>Supprimer</button>}
              </div>
            </article>
          );
        })}
      </div>
      {toast}
    </div>
  );
}
