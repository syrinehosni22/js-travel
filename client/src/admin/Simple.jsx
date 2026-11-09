import { useState } from 'react';
import { adminApi } from '../api.js';
import { useLoad, Top, Err, useToast, getPath, setPath, useConfirm } from './shared.jsx';
import { useAdmin } from './AdminApp.jsx';

/**
 * Tableau CRUD générique : liste + formulaire d'ajout/modification.
 * fields = [{ key: 'code', label: 'Code', type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea', options }]
 */
function Crud({ title, endpoint, fields, empty, columns, canCreate = true, noun = 'cet élément', nameOf }) {
  const { data, error, reload } = useLoad(() => adminApi.get(endpoint), [endpoint]);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState(null);
  const [toast, say] = useToast();
  const confirm = useConfirm();
  const { user } = useAdmin();
  const label = (row) => (nameOf ? nameOf(row) : getPath(row, (columns || fields)[0].key)) || '';
  async function remove(row) {
    const ok = await confirm({ title: `Supprimer ${noun} ${label(row) ? `« ${label(row)} »` : ''} ?`, confirmLabel: 'Supprimer' });
    if (!ok) return;
    setErr(null);
    try { await adminApi.del(`${endpoint}/${row._id}`); if (edit?._id === row._id) setEdit(null); reload(); say('Supprimé'); } catch (x) { setErr(x); }
  }
  async function save(e) {
    e.preventDefault(); setErr(null);
    try {
      if (edit._id) await adminApi.put(`${endpoint}/${edit._id}`, edit); else await adminApi.post(endpoint, edit);
      setEdit(null); reload(); say(edit._id ? 'Modifications enregistrées' : 'Ajouté');
    } catch (x) { setErr(x); }
  }
  const cols = columns || fields.slice(0, 5);
  const show = (row, f) => {
    const v = getPath(row, f.key);
    if (f.type === 'checkbox') return v ? '✓' : '—';
    if (f.type === 'date' && v) return String(v).slice(0, 10);
    return v ?? '—';
  };
  return (
    <>
      <Top title={title}>{canCreate && <button className="btn btn--green" onClick={() => setEdit(structuredClone(empty))}>+ Ajouter</button>}</Top>
      <Err error={error} />
      {edit && (
        <form className="panel stack" style={{ marginBottom: 16 }} onSubmit={save}>
          <h3>{edit._id ? `Modifier ${noun}` : `Ajouter ${noun}`}</h3>
          <div className="grid-3">
            {fields.map((f) => {
              const v = getPath(edit, f.key);
              const on = (val) => setEdit(setPath(edit, f.key, val));
              if (f.type === 'checkbox') return <label key={f.key} className="check"><input type="checkbox" checked={!!v} onChange={(e) => on(e.target.checked)} />{f.label}</label>;
              if (f.type === 'select') return <label key={f.key} className="lbl">{f.label}<select className="inp" value={v ?? ''} onChange={(e) => on(e.target.value)}>{f.options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>;
              if (f.type === 'textarea') return <label key={f.key} className="lbl" style={{ gridColumn: '1 / -1' }}>{f.label}<textarea className="inp" rows={6} value={v ?? ''} onChange={(e) => on(e.target.value)} /></label>;
              return <label key={f.key} className="lbl">{f.label}<input className="inp" type={f.type || 'text'} required={f.required} value={f.type === 'date' && v ? String(v).slice(0, 10) : v ?? ''} onChange={(e) => on(f.type === 'number' ? +e.target.value : e.target.value)} /></label>;
            })}
          </div>
          <Err error={err} />
          <div className="row"><button className="btn btn--green">Enregistrer</button><button type="button" className="btn btn--outline" onClick={() => setEdit(null)}>Annuler</button></div>
        </form>
      )}
      {!edit && <Err error={err} />}
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr>{cols.map((f) => <th key={f.key}>{f.label}</th>)}<th></th></tr></thead>
          <tbody>{(data || []).map((row) => (
            <tr key={row._id}>
              {cols.map((f) => <td key={f.key}>{String(show(row, f))}</td>)}
              <td><div className="actions">
                <button className="btn btn--outline btn-sm" onClick={() => { setEdit(structuredClone({ ...row, ...(endpoint === '/users' ? { password: '' } : {}) })); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Modifier</button>
                {!(endpoint === '/users' && row._id === user.id) && <button className="btn btn--danger-outline btn-sm" onClick={() => remove(row)}>Supprimer</button>}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
        {data && data.length === 0 && <p className="muted" style={{ marginTop: 8 }}>Aucun élément.</p>}
      </div>
      {toast}
    </>
  );
}

export const Promos = () => (
  <Crud title="Codes promo" endpoint="/promos" noun="le code promo" empty={{ code: '', percent: 10, active: true }}
    fields={[{ key: 'code', label: 'Code', required: true }, { key: 'percent', label: 'Remise %', type: 'number' }, { key: 'active', label: 'Actif', type: 'checkbox' },
      { key: 'validFrom', label: 'Du', type: 'date' }, { key: 'validTo', label: 'Au', type: 'date' }, { key: 'maxUses', label: 'Utilisations max', type: 'number' }, { key: 'uses', label: 'Utilisé', type: 'number' }]}
    columns={[{ key: 'code', label: 'Code' }, { key: 'percent', label: '%' }, { key: 'active', label: 'Actif', type: 'checkbox' }, { key: 'uses', label: 'Utilisations' }, { key: 'validTo', label: 'Fin', type: 'date' }]} />
);

export const Partners = () => (
  <>
    <Crud title="Partenaires (hôtels, agences)" endpoint="/partners" noun="le partenaire" empty={{ name: '', type: 'hotel', discountPercent: 0, commissionPercent: 10, trackingCode: '' }}
      fields={[{ key: 'name', label: 'Nom', required: true }, { key: 'type', label: 'Type', type: 'select', options: [['hotel', 'Hôtel'], ['agency', 'Agence']] },
        { key: 'discountPercent', label: 'Tarif partenaire (remise %)', type: 'number' }, { key: 'commissionPercent', label: 'Commission %', type: 'number' },
        { key: 'trackingCode', label: 'Code de suivi (lien ?partner=CODE)' }, { key: 'contact.email', label: 'E-mail' }, { key: 'contact.phone', label: 'Téléphone' }]} />
    <p className="muted" style={{ marginTop: 12 }}>Lien de suivi à donner au partenaire : <code>{location.origin}/fr?partner=CODE</code></p>
  </>
);

export const Users = () => (
  <Crud title="Équipe et rôles" endpoint="/users" noun="le compte" empty={{ name: '', email: '', role: 'manager', password: '' }}
    fields={[{ key: 'name', label: 'Nom', required: true }, { key: 'email', label: 'E-mail', type: 'email', required: true },
      { key: 'role', label: 'Rôle', type: 'select', options: [['admin', 'Administrateur'], ['manager', 'Gestionnaire de réservations'], ['editor', 'Rédacteur'], ['driver', 'Chauffeur'], ['partner', 'Partenaire']] },
      { key: 'phone', label: 'Téléphone (WhatsApp)' }, { key: 'password', label: 'Mot de passe (10 caractères min. — vide = inchangé)', type: 'password' },
      { key: 'vehicle.label', label: 'Véhicule (chauffeur)' }, { key: 'vehicle.capacity', label: 'Places', type: 'number' }, { key: 'active', label: 'Actif', type: 'checkbox' }]}
    columns={[{ key: 'name', label: 'Nom' }, { key: 'email', label: 'E-mail' }, { key: 'role', label: 'Rôle' }, { key: 'twoFactorEnabled', label: '2FA', type: 'checkbox' }, { key: 'active', label: 'Actif', type: 'checkbox' }]} />
);

export const Messages = () => (
  <Crud title="Messages du formulaire de contact" endpoint="/messages" canCreate={false} noun="le message de" empty={{}}
    fields={[{ key: 'name', label: 'Nom' }, { key: 'email', label: 'E-mail' }, { key: 'phone', label: 'Téléphone' }, { key: 'subject', label: 'Sujet' }, { key: 'handled', label: 'Traité', type: 'checkbox' }, { key: 'message', label: 'Message', type: 'textarea' }]} />
);

export const Posts = () => (
  <Crud title="Blog" endpoint="/posts" noun="l’article" empty={{ title: { fr: '' }, excerpt: { fr: '' }, body: { fr: '' }, published: false, category: '' }}
    fields={[{ key: 'title.fr', label: 'Titre', required: true }, { key: 'category', label: 'Catégorie' }, { key: 'image', label: 'Image (URL)' },
      { key: 'published', label: 'Publié', type: 'checkbox' }, { key: 'publishedAt', label: 'Date', type: 'date' },
      { key: 'excerpt.fr', label: 'Extrait (2 lignes)' }, { key: 'body.fr', label: 'Contenu (HTML) — en français, traduit automatiquement à l’enregistrement', type: 'textarea' }]}
    columns={[{ key: 'title.fr', label: 'Titre' }, { key: 'category', label: 'Catégorie' }, { key: 'published', label: 'Publié', type: 'checkbox' }, { key: 'publishedAt', label: 'Date', type: 'date' }]} />
);
