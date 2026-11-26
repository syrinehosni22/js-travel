import { useState } from 'react';
import { adminApi } from '../api.js';
import { useLoad, Top, Err, useToast, useConfirm } from './shared.jsx';
import { telHref } from '../lib/contact.js';

const EMPTY = { name: '', phone: '', languages: '', notes: '', email: '', password: '', active: true };
const toForm = (d) => ({ ...EMPTY, ...d, languages: (d.languages || []).join(', '), password: '' });
const toBody = (f) => ({
  name: f.name.trim(), phone: f.phone.trim(), notes: f.notes, active: f.active,
  languages: f.languages.split(',').map((x) => x.trim()).filter(Boolean),
  ...(f.email ? { email: f.email.trim() } : {}), ...(f.password ? { password: f.password } : {}),
});

/**
 * Chauffeurs et véhicules : deux listes indépendantes. Pour chaque prestation (excursion ou transfert),
 * on choisit un chauffeur ET un véhicule, depuis la réservation ou le Planning.
 */
export default function DriversAndFleet() {
  const [tab, setTab] = useState('drivers');
  return (
    <>
      <Top title="Chauffeurs et véhicules">
        <div className="tabs" role="tablist" style={{ margin: 0 }}>
          <button role="tab" aria-selected={tab === 'drivers'} onClick={() => setTab('drivers')}>Chauffeurs</button>
          <button role="tab" aria-selected={tab === 'fleet'} onClick={() => setTab('fleet')}>Véhicules</button>
        </div>
      </Top>
      <p className="help">Un chauffeur n’est pas lié à un véhicule : pour chaque prestation (excursion ou transfert), choisissez le <b>chauffeur</b> et le <b>véhicule</b> dans la réservation ou dans le <b>Planning</b>. Les deux apparaissent dans l’e-mail et le WhatsApp de confirmation envoyés au client.</p>
      {tab === 'drivers' ? <Drivers /> : <Fleet />}
    </>
  );
}

function Drivers() {
  const { data, error, reload } = useLoad(() => adminApi.get('/drivers'));
  const [form, setForm] = useState(null);   // { ...champs, _id? }
  const [err, setErr] = useState(null);
  const [toast, say] = useToast();
  const confirm = useConfirm();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e) {
    e.preventDefault(); setErr(null);
    try {
      if (form._id) await adminApi.put(`/drivers/${form._id}`, toBody(form));
      else await adminApi.post('/drivers', toBody(form));
      say(form._id ? 'Chauffeur modifié' : 'Chauffeur ajouté'); setForm(null); reload();
    } catch (x) { setErr(x); }
  }
  async function remove(d) {
    if (!(await confirm({ title: `Supprimer le chauffeur « ${d.name} » ?`, message: 'S’il a déjà des réservations, il est seulement désactivé pour garder l’historique.', confirmLabel: 'Supprimer' }))) return;
    const r = await adminApi.del(`/drivers/${d._id}`);
    say(r.deactivated ? 'Chauffeur désactivé (il a des réservations)' : 'Chauffeur supprimé'); reload();
  }
  const list = data || [];

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}><button className="btn btn--green" onClick={() => { setErr(null); setForm({ ...EMPTY }); }}>+ Ajouter un chauffeur</button></div>
      <Err error={error} />

      {form && (
        <form className="panel stack" onSubmit={save}>
          <h2 style={{ fontSize: 18 }}>{form._id ? `Modifier ${form.name}` : 'Nouveau chauffeur'}</h2>
          <Err error={err} />
          <div className="grid-2">
            <label className="lbl">Nom *<input className="inp" required minLength={2} value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
            <label className="lbl">Téléphone WhatsApp * <small style={{ fontWeight: 400 }}>(format international, ex. +216 20 000 000)</small><input className="inp" required type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
            <label className="lbl">Langues parlées <small style={{ fontWeight: 400 }}>(séparées par des virgules)</small><input className="inp" placeholder="Français, Anglais" value={form.languages} onChange={(e) => set('languages', e.target.value)} /></label>
          </div>
          <label className="lbl">Remarques internes<textarea className="inp" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></label>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Accès au planning (facultatif)</summary>
            <p className="muted" style={{ fontSize: 14 }}>Avec un e-mail et un mot de passe, le chauffeur peut se connecter à l’admin et ne voit que son propre planning.</p>
            <div className="grid-2">
              <label className="lbl">E-mail de connexion<input className="inp" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
              <label className="lbl">{form._id ? 'Nouveau mot de passe' : 'Mot de passe'} <small style={{ fontWeight: 400 }}>(10 caractères minimum)</small><input className="inp" type="password" minLength={10} autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} /></label>
            </div>
          </details>
          {form._id && <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />Actif (proposé dans les réservations et le planning)</label>}
          <div className="row"><button className="btn btn--green">Enregistrer</button><button type="button" className="btn btn--outline" onClick={() => setForm(null)}>Annuler</button></div>
        </form>
      )}

      {list.length === 0 && !form && <p className="panel muted">Aucun chauffeur pour l’instant. Cliquez sur « Ajouter un chauffeur ».</p>}
      <div className="route-grid">
        {list.map((d) => (
          <article key={d._id} className="route-card" style={{ opacity: d.active ? 1 : 0.6 }}>
            <header><strong>{d.name}{!d.active && ' (inactif)'}</strong></header>
            {telHref(d.phone) && <a href={telHref(d.phone)}>{d.phone}</a>}
            {d.languages?.length > 0 && <span className="muted">Langues : {d.languages.join(', ')}</span>}
            {d.canLogin && <span className="muted">Accès planning : {d.email}</span>}
            <div className="row">
              <button type="button" className="btn btn--outline btn-sm" onClick={() => { setErr(null); setForm(toForm(d)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Modifier</button>
              <button type="button" className="btn btn--danger-outline btn-sm" onClick={() => remove(d)}>Supprimer</button>
            </div>
          </article>
        ))}
      </div>
      {toast}
    </>
  );
}

const EMPTY_V = { label: '', plate: '', capacity: '', notes: '', active: true };

/** Flotte : véhicules (modèle, immatriculation, places), choisis pour chaque prestation */
function Fleet() {
  const { data, error, reload } = useLoad(() => adminApi.get('/fleet'));
  const [form, setForm] = useState(null);
  const [err, setErr] = useState(null);
  const [toast, say] = useToast();
  const confirm = useConfirm();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  async function save(e) {
    e.preventDefault(); setErr(null);
    const body = { label: form.label.trim(), plate: form.plate.trim(), notes: form.notes, active: form.active, ...(form.capacity !== '' && form.capacity != null && { capacity: +form.capacity }) };
    try {
      if (form._id) await adminApi.put(`/fleet/${form._id}`, body); else await adminApi.post('/fleet', body);
      say(form._id ? 'Véhicule modifié' : 'Véhicule ajouté'); setForm(null); reload();
    } catch (x) { setErr(x); }
  }
  async function remove(v) {
    if (!(await confirm({ title: `Supprimer le véhicule « ${v.label} » ?`, message: 'S’il a déjà servi pour des réservations, il est seulement désactivé.', confirmLabel: 'Supprimer' }))) return;
    const r = await adminApi.del(`/fleet/${v._id}`);
    say(r.deactivated ? 'Véhicule désactivé (il a des réservations)' : 'Véhicule supprimé'); reload();
  }
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}><button className="btn btn--green" onClick={() => { setErr(null); setForm({ ...EMPTY_V }); }}>+ Ajouter un véhicule</button></div>
      <Err error={error} />
      {form && (
        <form className="panel stack" onSubmit={save}>
          <h2 style={{ fontSize: 18 }}>{form._id ? `Modifier ${form.label}` : 'Nouveau véhicule'}</h2>
          <Err error={err} />
          <div className="grid-3">
            <label className="lbl">Modèle *<input className="inp" required minLength={2} placeholder="Ex. Toyota Hiace" value={form.label} onChange={(e) => set('label', e.target.value)} /></label>
            <label className="lbl">Immatriculation<input className="inp" placeholder="Ex. 123 TU 4567" value={form.plate || ''} onChange={(e) => set('plate', e.target.value)} /></label>
            <label className="lbl">Places passagers<input className="inp" type="number" min="1" value={form.capacity ?? ''} onChange={(e) => set('capacity', e.target.value)} /></label>
          </div>
          <label className="lbl">Remarques<input className="inp" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} /></label>
          {form._id && <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={form.active !== false} onChange={(e) => set('active', e.target.checked)} />Actif (proposé dans les réservations et le planning)</label>}
          <div className="row"><button className="btn btn--green">Enregistrer</button><button type="button" className="btn btn--outline" onClick={() => setForm(null)}>Annuler</button></div>
        </form>
      )}
      {(data || []).length === 0 && !form && <p className="panel muted">Aucun véhicule pour l’instant. Cliquez sur « Ajouter un véhicule ».</p>}
      <div className="route-grid">
        {(data || []).map((v) => (
          <article key={v._id} className="route-card" style={{ opacity: v.active !== false ? 1 : 0.6 }}>
            <header><strong>{v.label}{v.active === false && ' (inactif)'}</strong></header>
            <span className="muted">{[v.plate, v.capacity && `${v.capacity} places`].filter(Boolean).join(' · ') || '—'}</span>
            {v.notes && <span className="muted">{v.notes}</span>}
            <div className="row">
              <button type="button" className="btn btn--outline btn-sm" onClick={() => { setErr(null); setForm({ ...EMPTY_V, ...v, capacity: v.capacity ?? '' }); }}>Modifier</button>
              <button type="button" className="btn btn--danger-outline btn-sm" onClick={() => remove(v)}>Supprimer</button>
            </div>
          </article>
        ))}
      </div>
      {toast}
    </>
  );
}
