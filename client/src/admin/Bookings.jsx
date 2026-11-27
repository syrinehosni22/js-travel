import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi, adminDownload, API_URL } from '../api.js';
import { useAdmin } from './AdminApp.jsx';
import { useLoad, Top, eur, Status, STATUS, Err, useToast, useConfirm } from './shared.jsx';
import { countryName } from '../lib/countries.js';

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
/** Mini-formulaire : nouveau chauffeur ou nouveau véhicule, créé puis affecté à la prestation */
function QuickAdd({ kind, onCancel, onCreate }) {
  const isDriver = kind === 'driver';
  const [f, setF] = useState(isDriver ? { name: '', phone: '' } : { label: '', plate: '', capacity: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); e.stopPropagation(); setErr(null); setBusy(true);
    const values = isDriver ? { name: f.name.trim(), phone: f.phone.trim() } : { label: f.label.trim(), plate: f.plate.trim(), ...(f.capacity && { capacity: +f.capacity }) };
    try { await onCreate(values); } catch (x) { setErr(x); setBusy(false); }
  }
  return (
    <form className="panel stack quick-add" style={{ gap: 8, background: '#F8F5EE' }} onSubmit={submit}>
      <strong>{isDriver ? 'Nouveau chauffeur' : 'Nouveau véhicule'}</strong>
      <Err error={err} />
      {isDriver ? (
        <div className="grid-2 grid-2--tight">
          <label className="lbl">Nom *<input className="inp" required minLength={2} autoFocus value={f.name} onChange={set('name')} /></label>
          <label className="lbl">Téléphone WhatsApp *<input className="inp" required type="tel" placeholder="+216 20 000 000" value={f.phone} onChange={set('phone')} /></label>
        </div>
      ) : (
        <div className="grid-3">
          <label className="lbl">Modèle *<input className="inp" required minLength={2} autoFocus placeholder="Ex. Toyota Hiace" value={f.label} onChange={set('label')} /></label>
          <label className="lbl">Immatriculation<input className="inp" placeholder="123 TU 4567" value={f.plate} onChange={set('plate')} /></label>
          <label className="lbl">Places<input className="inp" type="number" min="1" value={f.capacity} onChange={set('capacity')} /></label>
        </div>
      )}
      <div className="row"><button className="btn btn--green btn-sm" disabled={busy}>{busy ? 'Création…' : 'Créer et affecter'}</button><button type="button" className="btn btn--outline btn-sm" onClick={onCancel}>Annuler</button></div>
    </form>
  );
}

/**
 * Prix d'une prestation : remise en % (calculée sur le prix d'origine) ou nouveau prix saisi à la main.
 * Le client voit la remise dans sa confirmation ; « Prix d'origine » annule la modification.
 */
function PriceEditor({ item, onApply }) {
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const base = item.basePriceEur ?? item.totalEur;
  const adj = (item.lines || []).find((l) => l.key === 'adminDiscount');
  const preview = percent !== '' ? Math.round(base * (1 - Math.min(100, Math.max(0, +percent)) / 100) * 100) / 100 : null;
  const done = (ok) => { if (ok) { setOpen(false); setPercent(''); setAmount(''); setReason(''); } };
  if (!open) {
    return (
      <div className="row" style={{ gap: 8 }}>
        {adj && <span className="muted">{adj.amount < 0 ? `Remise ${Math.round((adj.rate || 0) * 100)} %` : 'Prix ajusté'} ({eur(adj.amount)}){adj.label && !['Remise', 'Ajustement'].includes(adj.label) ? ` · ${adj.label}` : ''}</span>}
        <button type="button" className="link-btn" onClick={() => setOpen(true)}>{adj ? 'Modifier la remise' : 'Faire une remise / changer le prix'}</button>
        {adj && <button type="button" className="link-btn" onClick={async () => done(await onApply({ mode: 'reset' }, `Prix d’origine rétabli : ${eur(base)}`))}>Prix d’origine</button>}
      </div>
    );
  }
  return (
    <div className="panel stack" style={{ gap: 10, background: '#F8F5EE' }}>
      <strong>Prix de la prestation <small className="muted" style={{ fontWeight: 400 }}>· prix d’origine {eur(base)}</small></strong>
      <div className="row" style={{ alignItems: 'flex-end', gap: 10 }}>
        <label className="lbl" style={{ width: 130 }}>Remise (%)<input className="inp" type="number" min="0" max="100" step="0.5" value={percent} onChange={(e) => { setPercent(e.target.value); setAmount(''); }} /></label>
        <span className="muted" style={{ paddingBottom: 12 }}>ou</span>
        <label className="lbl" style={{ width: 160 }}>Nouveau prix (€)<input className="inp" type="number" min="0" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setPercent(''); }} /></label>
        <label className="lbl" style={{ flex: '1 1 160px' }}>Motif (facultatif)<input className="inp" maxLength={80} placeholder="Ex. client fidèle" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </div>
      {preview != null && <span className="muted">Nouveau prix : <b>{eur(preview)}</b> (−{eur(base - preview)})</span>}
      {amount !== '' && <span className="muted">{+amount < base ? `Remise de ${eur(base - +amount)} (${Math.round((1 - +amount / base) * 100)} %)` : +amount > base ? `Supplément de ${eur(+amount - base)}` : 'Prix d’origine'}</span>}
      <div className="row">
        <button type="button" className="btn btn--green btn-sm" disabled={percent === '' && amount === ''}
          onClick={async () => done(await onApply(percent !== '' ? { mode: 'percent', value: +percent, reason: reason || undefined } : { mode: 'amount', value: +amount, reason: reason || undefined }, 'Prix modifié — pensez à « Envoyer la confirmation au client »'))}>Appliquer</button>
        <button type="button" className="btn btn--outline btn-sm" onClick={() => setOpen(false)}>Annuler</button>
      </div>
    </div>
  );
}

/** Remise en % sur toutes les prestations de la réservation */
function DiscountAll({ onApply }) {
  const [percent, setPercent] = useState('');
  const [reason, setReason] = useState('');
  return (
    <form className="panel row" style={{ alignItems: 'flex-end', gap: 10 }} onSubmit={async (e) => { e.preventDefault(); if (await onApply({ percent: +percent, reason: reason || undefined }, +percent ? `Remise de ${percent} % sur toute la réservation` : 'Prix d’origine rétablis')) { setPercent(''); setReason(''); } }}>
      <label className="lbl" style={{ width: 200 }}>Remise sur toute la réservation (%)<input className="inp" type="number" min="0" max="100" step="0.5" required value={percent} onChange={(e) => setPercent(e.target.value)} /></label>
      <label className="lbl" style={{ flex: '1 1 160px' }}>Motif (facultatif)<input className="inp" maxLength={80} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <button className="btn btn--green btn-sm">Appliquer</button>
    </form>
  );
}

function BookingDrawer({ id, onClose, onSaved }) {
  const { data: b, reload, error } = useLoad(() => adminApi.get(`/bookings/${id}`), [id]);
  // Texte de la réservation pour l'envoi par WhatsApp (au client ou à un contact : chauffeur, guide, partenaire…)
  const [waText, setWaText] = useState('');
  useEffect(() => { adminApi.get(`/bookings/${id}/whatsapp-text`).then((r) => setWaText(r.text)).catch(() => setWaText('')); }, [id, b?.updatedAt]);
  const [toast, say] = useToast();
  const [collected, setCollected] = useState('');
  useEffect(() => { if (b) setCollected(b.collectedAmount ?? b.totalEur); }, [b]);
  const { user } = useAdmin();
  const canEdit = ['admin', 'manager'].includes(user.role);
  const confirm = useConfirm();
  const removeBooking = useDeleteBooking();
  const { data: drivers, reload: reloadDrivers } = useLoad(() => (canEdit ? adminApi.get('/drivers') : Promise.resolve([])), [canEdit]);
  const { data: fleet, reload: reloadFleet } = useLoad(() => (canEdit ? adminApi.get('/fleet') : Promise.resolve([])), [canEdit]);
  // Ajout rapide d'un chauffeur ou d'un véhicule depuis la réservation : { item, kind: 'driver' | 'vehicle' }
  const [quick, setQuick] = useState(null);
  async function quickCreate(values) {
    const isDriver = quick.kind === 'driver';
    const created = await adminApi.post(isDriver ? '/drivers' : '/fleet', values);
    await (isDriver ? reloadDrivers() : reloadFleet());
    await patch({ items: [{ _id: quick.item, [quick.kind]: created._id }] }, isDriver ? `Chauffeur « ${created.name} » créé et affecté` : `Véhicule « ${created.label} » créé et choisi`);
    setQuick(null);
  }
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
              <label className="lbl">Ville de l’hôtel<input className="inp" value={cust.city || ''} onChange={(e) => setCust({ ...cust, city: e.target.value })} /></label>
              <label className="lbl">Hôtel<input className="inp" value={cust.hotel || ''} onChange={(e) => setCust({ ...cust, hotel: e.target.value })} /></label>
              <label className="lbl">Nationalité (code pays, ex. FR)<input className="inp" maxLength={2} value={cust.nationality || ''} onChange={(e) => setCust({ ...cust, nationality: e.target.value.toUpperCase() })} /></label>
              <label className="lbl">Chambre<input className="inp" value={cust.room || ''} onChange={(e) => setCust({ ...cust, room: e.target.value })} /></label>
            </div>
            <label className="lbl">Remarques<textarea className="inp" rows={3} value={cust.notes || ''} onChange={(e) => setCust({ ...cust, notes: e.target.value })} /></label>
            <div className="row"><button className="btn btn--green btn-sm">Enregistrer</button><button type="button" className="btn btn--outline btn-sm" onClick={() => setCust(null)}>Annuler</button></div>
          </form>
        ) : (
        <div className="panel">
          {canEdit && <button type="button" className="btn btn--outline btn-sm" style={{ float: 'right' }} onClick={() => setCust({ name: b.customer.name, email: b.customer.email, phone: b.customer.phone, hotel: b.customer.hotel || '', city: b.customer.city || '', nationality: b.customer.nationality || '', room: b.customer.room || '', notes: b.customer.notes || '' })}>Modifier</button>}
          <strong>{b.customer.name}</strong><br />
          <a href={`mailto:${b.customer.email}`}>{b.customer.email}</a> · <a href={`https://wa.me/${(b.customer.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{b.customer.phone}</a><br />
          {b.customer.nationality && <>Nationalité : {countryName(b.customer.nationality)}<br /></>}
          {b.customer.city && `${b.customer.city} · `}{b.customer.hotel} {b.customer.room && `· ch. ${b.customer.room}`}
          {b.customer.notes && <p className="muted" style={{ marginTop: 8 }}>« {b.customer.notes} »</p>}
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Langue {b.lang?.toUpperCase()} · {b.channel} {b.promoCode && `· code ${b.promoCode}`}</p>
        </div>
        )}
        {b.items.map((i) => (
          <div key={i._id} className="panel stack" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><strong>{i.title}</strong>
              <span>{i.basePriceEur != null && i.basePriceEur !== i.totalEur && <s className="muted" style={{ marginRight: 8 }}>{eur(i.basePriceEur)}</s>}{eur(i.totalEur)}</span></div>
            <span className="muted">{i.date} {i.time} · {i.participants?.adult} ad. {i.participants?.child ? `+ ${i.participants.child} enf.` : ''} {i.participants?.infant ? `+ ${i.participants.infant} bébé` : ''} {i.zone && `· ${i.zone}`} {i.guideLang && `· guide ${i.guideLang.toUpperCase()}`}</span>
            {i.transfer && <span className="muted">{i.transfer.from} → {i.transfer.to} · {i.transfer.vehicle} {i.transfer.flightNumber && `· vol ${i.transfer.flightNumber}`}</span>}
            {i.options?.length > 0 && <span className="muted">Options : {i.options.join(', ')}</span>}
            {(i.lines || []).filter((l) => l.key === 'guide' || l.key === 'cityTransfer').map((l, k) => (
              <span key={k} className="muted">{l.key === 'guide' ? 'Guide en option' : `Déplacement depuis ${l.label}`} : {eur(l.amount)}</span>
            ))}
            {i.cityTransferOnRequest && <span className="alert alert--warn" style={{ margin: 0 }}>Hôtel à {i.city} : déplacement sans prix configuré — à confirmer avec le client.</span>}
            {canEdit && (
              <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
                <label className="lbl" style={{ maxWidth: 200 }}>Date<input className="inp" type="date" defaultValue={i.date} onBlur={(e) => e.target.value !== i.date && patch({ items: [{ _id: i._id, date: e.target.value }] })} /></label>
                <label className="lbl" style={{ flex: '1 1 220px' }}>Chauffeur
                  <select className="inp" value={i.driver?._id || i.driver || ''} onChange={(e) => (e.target.value === '__new' ? setQuick({ item: i._id, kind: 'driver' }) : patch({ items: [{ _id: i._id, driver: e.target.value || null }] }, e.target.value ? 'Chauffeur affecté — pensez à « Envoyer la confirmation au client »' : 'Chauffeur retiré'))}>
                    <option value="">— Aucun chauffeur —</option>
                    <option value="__new">+ Nouveau chauffeur…</option>
                    {(drivers || []).filter((d) => d.active || String(d._id) === String(i.driver?._id || i.driver)).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </label>
                <label className="lbl" style={{ flex: '1 1 220px' }}>Véhicule
                  <select className="inp" value={i.vehicle?._id || i.vehicle || ''} onChange={(e) => (e.target.value === '__new' ? setQuick({ item: i._id, kind: 'vehicle' }) : patch({ items: [{ _id: i._id, vehicle: e.target.value || null }] }, e.target.value ? 'Véhicule choisi' : 'Véhicule retiré'))}>
                    <option value="">— Aucun véhicule —</option>
                    <option value="__new">+ Nouveau véhicule…</option>
                    {(fleet || []).filter((v) => v.active !== false || String(v._id) === String(i.vehicle?._id || i.vehicle)).map((v) => <option key={v._id} value={v._id}>{v.label}{v.plate ? ` · ${v.plate}` : ''}{v.capacity ? ` (${v.capacity} pl.)` : ''}</option>)}
                  </select>
                </label>
              </div>
            )}
            {canEdit && i.status !== 'cancelled' && <PriceEditor item={i} onApply={(price, msg) => patch({ items: [{ _id: i._id, price }] }, msg)} />}
            {quick?.item === i._id && <QuickAdd kind={quick.kind} onCancel={() => setQuick(null)} onCreate={quickCreate} />}
            {i.vehicle?.label && <span className="muted">Véhicule : <b>{i.vehicle.label}</b>{i.vehicle.plate && ` · ${i.vehicle.plate}`}{i.vehicle.capacity && ` · ${i.vehicle.capacity} places`}{(i.vehicle.capacity && (i.participants?.adult || 0) + (i.participants?.child || 0) + (i.participants?.infant || 0) > i.vehicle.capacity) && <b style={{ color: '#9B1C1C' }}> — trop petit pour le groupe</b>}</span>}
            {i.driver?.name && (
              <span className="muted">Chauffeur : <b>{i.driver.name}</b> {i.driver.phone && <>· <a href={`tel:${i.driver.phone.replace(/[^\d+]/g, '')}`}>{i.driver.phone}</a> · <a href={`https://wa.me/${i.driver.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Mission ${b.ref}\n${i.title} — ${i.date} ${i.time || ''}\nClient : ${b.customer.name} · ${b.customer.phone || ''}\nHôtel : ${[b.customer.hotel, b.customer.city].filter(Boolean).join(', ')}${i.vehicle?.label ? `\nVéhicule : ${i.vehicle.label}${i.vehicle.plate ? ` (${i.vehicle.plate})` : ''}` : ''}`)}`} target="_blank" rel="noreferrer">envoyer la mission par WhatsApp</a></>}</span>
            )}
            {canEdit && ((drivers && drivers.length === 0) || (fleet && fleet.length === 0)) && <small className="muted">Ajoutez vos chauffeurs et vos véhicules dans le menu « Chauffeurs et véhicules ».</small>}
          </div>
        ))}
        <div className="panel row" style={{ justifyContent: 'space-between' }}><strong>Total à régler sur place</strong><strong>{eur(b.totalEur)}</strong></div>
        {canEdit && b.items.length > 1 && <DiscountAll onApply={(discountAll, msg) => patch({ discountAll }, msg)} />}
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
          {waText && (
            <div className="row">
              <a className="btn btn--whatsapp btn-sm" href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer">Envoyer via WhatsApp</a>
              {b.customer?.phone && <a className="btn btn--outline btn-sm" href={`https://wa.me/${b.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer">WhatsApp au client</a>}
              <button type="button" className="btn btn--outline btn-sm" onClick={() => navigator.clipboard?.writeText(waText).then(() => say('Texte copié'))}>Copier le texte</button>
            </div>
          )}
          <div className="row">
            <button className="btn btn--outline btn-sm" title="E-mail + WhatsApp au client, avec le bon PDF et le chauffeur s’il est choisi" onClick={() => adminApi.post(`/bookings/${id}/resend`).then((r) => say(r.mail?.ok === false ? `Confirmation non envoyée : ${r.mail.error}` : `Confirmation envoyée au client${r.drivers ? ' (avec le chauffeur)' : ''}`))}>Envoyer la confirmation au client</button>
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
