import { useEffect, useMemo, useState } from 'react';
import { slugify } from '../lib/seo.js';
import { adminApi } from '../api.js';
import { useLoad, Top, Err, useToast, setPath, useConfirm, TRANSLATION_WARNING } from './shared.jsx';

/**
 * Transferts — organisé en 5 onglets simples :
 *   Prix des trajets · Véhicules · Lieux et zones · Suppléments · Pages Google
 * Tout se saisit en français : les autres langues sont traduites automatiquement à l'enregistrement.
 */
const TYPES = { airport: 'Aéroport', city: 'Ville', hotel: 'Hôtel' };
const DEFAULT_FACTORS = { sedan: 1, minivan: 1.4, minibus: 2.4, vip: 1.8 };
/** Types de véhicules proposés par défaut (capacités modifiables dans l'onglet « Véhicules ») */
const STANDARD_VEHICLES = [
  { key: 'sedan', label: { fr: 'Berline' }, maxPassengers: 3, maxLuggage: 3, perKm: 0.9, minFare: 30 },
  { key: 'minivan', label: { fr: 'Minivan' }, maxPassengers: 7, maxLuggage: 7, perKm: 1.2, minFare: 40 },
  { key: 'minibus', label: { fr: 'Minibus' }, maxPassengers: 16, maxLuggage: 16, perKm: 1.8, minFare: 70 },
  { key: 'vip', label: { fr: 'Véhicule VIP' }, maxPassengers: 3, maxLuggage: 3, perKm: 1.6, minFare: 60 },
];
const key = (a, b) => `${a}|${b}`;
const sameRoute = (g, a, b) => (g.fromZone === a && g.toZone === b) || (g.fromZone === b && g.toZone === a);

export default function TransfersAdmin() {
  const { data, error, reload } = useLoad(() => adminApi.get('/transfers'));
  const [cfg, setCfg] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('prices');
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, say] = useToast();
  useEffect(() => { if (data) { setCfg(data.config || { vehicles: [], grid: [], supplements: {}, returnDiscount: 10, minNoticeHours: 12 }); setDirty(false); } }, [data]);
  useEffect(() => {
    const warn = (ev) => { if (dirty) { ev.preventDefault(); ev.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  if (error) return <Err error={error} />;
  if (!cfg) return <p>Chargement…</p>;

  const zones = data.zones || [];
  const zl = (k) => zones.find((z) => z.key === k)?.label?.fr || k;
  const update = (next) => { setCfg(next); setDirty(true); };
  const set = (p, v) => update(setPath(cfg, p, v));

  async function save() {
    setErr(null); setSaving(true);
    try {
      const { translation, ...r } = await adminApi.put('/transfers/config', cfg);
      setCfg(r); setDirty(false);
      say(translation?.error ? `Enregistré (${TRANSLATION_WARNING})` : 'Tarifs enregistrés');
    } catch (x) { setErr(x); }
    setSaving(false);
  }

  const TABS = { prices: 'Prix des trajets', vehicles: 'Véhicules', places: 'Lieux et zones', extras: 'Suppléments et règles', pages: 'Pages Google' };
  const configTab = ['prices', 'vehicles', 'extras'].includes(tab);
  return (
    <>
      <Top title="Transferts">{configTab && <button className="btn btn--green" onClick={save} disabled={!dirty || saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>}</Top>
      <div className="tabs tabs--scroll" role="tablist">{Object.entries(TABS).map(([k, v]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{v}</button>)}</div>
      <Err error={err} />
      {tab === 'prices' && <Prices cfg={cfg} update={update} zones={zones} zl={zl} />}
      {tab === 'vehicles' && <Vehicles cfg={cfg} update={update} set={set} />}
      {tab === 'extras' && <Extras cfg={cfg} set={set} />}
      {tab === 'places' && <Places data={data} zones={zones} zl={zl} reload={reload} say={say} grid={cfg.grid} />}
      {tab === 'pages' && <Pages data={data} zones={zones} zl={zl} reload={reload} say={say} />}
      {dirty && configTab && <div className="save-bar"><span>Modifications non enregistrées</span><button className="btn btn--green" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>}
      {toast}
    </>
  );
}

/* ======================= Prix des trajets ======================= */
function Prices({ cfg, update, zones, zl }) {
  const [q, setQ] = useState('');
  const [add, setAdd] = useState({ from: '', to: '', prices: {} });
  const [msg, setMsg] = useState('');
  const vehicles = cfg.vehicles || [];

  // Coefficient de chaque véhicule par rapport au premier (calculé sur la grille existante)
  const factors = useMemo(() => {
    const first = vehicles[0]?.key;
    const out = {};
    for (const v of vehicles) {
      const ratios = [];
      for (const g of cfg.grid) {
        if (g.vehicle !== v.key) continue;
        const ref = cfg.grid.find((x) => x.vehicle === first && x.fromZone === g.fromZone && x.toZone === g.toZone);
        if (ref?.price) ratios.push(g.price / ref.price);
      }
      ratios.sort((a, b) => a - b);
      out[v.key] = ratios.length ? ratios[Math.floor(ratios.length / 2)] : (DEFAULT_FACTORS[v.key] || 1);
    }
    return out;
  }, [cfg.grid, vehicles]);

  const routes = useMemo(() => {
    const seen = new Map();
    for (const g of cfg.grid) { const k = key(g.fromZone, g.toZone); if (!seen.has(k)) seen.set(k, { from: g.fromZone, to: g.toZone }); }
    const list = [...seen.values()].map((r) => ({ ...r, name: `${zl(r.from)} ⇄ ${zl(r.to)}` }));
    const needle = q.trim().toLowerCase();
    return list.filter((r) => !needle || r.name.toLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [cfg.grid, q, zones]); // eslint-disable-line

  const price = (r, v) => cfg.grid.find((g) => g.fromZone === r.from && g.toZone === r.to && g.vehicle === v)?.price ?? '';
  function setPrice(r, v, val) {
    const rest = cfg.grid.filter((g) => !(g.fromZone === r.from && g.toZone === r.to && g.vehicle === v));
    update({ ...cfg, grid: val === '' ? rest : [...rest, { fromZone: r.from, toZone: r.to, vehicle: v, price: +val }] });
  }
  const confirm = useConfirm();
  const remove = async (r) => {
    if (await confirm({ title: `Supprimer le trajet ${zl(r.from)} ⇄ ${zl(r.to)} ?`, message: 'Les prix de tous les véhicules pour ce trajet seront supprimés (après « Enregistrer »). Les clients ne pourront plus le réserver.', confirmLabel: 'Supprimer le trajet' })) {
      update({ ...cfg, grid: cfg.grid.filter((g) => !(g.fromZone === r.from && g.toZone === r.to)) });
    }
  };

  const setAddPrice = (k, v) => setAdd({ ...add, prices: { ...add.prices, [k]: v } });
  // Propose les prix manquants à partir du premier prix saisi (coefficients tirés de la grille existante)
  function suggest() {
    const ref = vehicles.find((v) => +add.prices[v.key] > 0);
    if (!ref) return setMsg('Saisissez d’abord au moins un prix.');
    const base = +add.prices[ref.key] / (factors[ref.key] || 1);
    const prices = { ...add.prices };
    for (const v of vehicles) if (!(+prices[v.key] > 0)) prices[v.key] = String(Math.round(base * (factors[v.key] || 1)));
    setAdd({ ...add, prices }); setMsg('');
  }

  function addRoute(ev) {
    ev.preventDefault(); setMsg('');
    if (add.from === add.to) return setMsg('Choisissez deux lieux différents.');
    if (cfg.grid.some((g) => sameRoute(g, add.from, add.to))) return setMsg('Ce trajet existe déjà : modifiez ses prix dans la liste.');
    const rows = vehicles.filter((v) => +add.prices[v.key] > 0)
      .map((v) => ({ fromZone: add.from, toZone: add.to, vehicle: v.key, price: Math.round(+add.prices[v.key] * 100) / 100 }));
    if (!rows.length) return setMsg('Indiquez le prix d’au moins un véhicule.');
    const skipped = vehicles.filter((v) => !(+add.prices[v.key] > 0)).map((v) => v.label?.fr || v.key);
    update({ ...cfg, grid: [...cfg.grid, ...rows] });
    setAdd({ from: '', to: '', prices: {} });
    setMsg(`Trajet ajouté : ${zl(add.from)} ⇄ ${zl(add.to)}${skipped.length ? ` (non proposé en ${skipped.join(', ')})` : ''}. Pensez à enregistrer.`);
  }

  return (
    <div className="stack">
      <p className="help">Prix d’un <b>aller simple</b>, par véhicule, en euros. Un trajet est valable dans les deux sens. Le client voit uniquement les véhicules assez grands pour son groupe.</p>

      <form className="panel add-route" onSubmit={addRoute}>
        <h3>Ajouter un trajet</h3>
        <div className="add-route__places">
          <label className="lbl">Départ<select className="inp" required value={add.from} onChange={(e) => setAdd({ ...add, from: e.target.value })}><option value="">Choisir…</option>{zones.map((z) => <option key={z.key} value={z.key}>{z.label?.fr || z.key}</option>)}</select></label>
          <span className="add-route__arrow" aria-hidden="true">⇄</span>
          <label className="lbl">Arrivée<select className="inp" required value={add.to} onChange={(e) => setAdd({ ...add, to: e.target.value })}><option value="">Choisir…</option>{zones.map((z) => <option key={z.key} value={z.key}>{z.label?.fr || z.key}</option>)}</select></label>
        </div>
        <fieldset className="add-route__prices">
          <legend>Prix par type de véhicule <small>(aller simple, en euros — laissez vide si le véhicule n’est pas proposé)</small></legend>
          <div className="vehicle-prices">
            {vehicles.map((v) => (
              <label key={v.key} className="vehicle-price">
                <span className="vehicle-price__name">{v.label?.fr || v.key}<small>{v.maxPassengers} pers. · {v.maxLuggage} valises</small></span>
                <span className="money-inp"><input type="number" min="0" step="1" inputMode="decimal" placeholder="—" value={add.prices[v.key] ?? ''} onChange={(e) => setAddPrice(v.key, e.target.value)} aria-label={`Prix ${v.label?.fr || v.key}`} /><i>€</i></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          {vehicles.length > 1 ? <button type="button" className="link-btn" onClick={suggest}>Proposer les prix manquants à partir du premier prix saisi</button> : <span />}
          <button className="btn btn--green">Ajouter le trajet</button>
        </div>
        {msg && <p className="alert alert--info" role="status">{msg}</p>}
        {zones.length === 0 && <p className="alert alert--warn">Créez d’abord des zones dans l’onglet « Lieux et zones ».</p>}
        {vehicles.length === 0 && <p className="alert alert--warn">Ajoutez d’abord vos véhicules dans l’onglet « Véhicules ».</p>}
      </form>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>{routes.length} trajet{routes.length > 1 ? 's' : ''}</strong>
        <input className="inp" type="search" placeholder="Rechercher un trajet (ex. Sousse)" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 240px', maxWidth: 360 }} aria-label="Rechercher un trajet" />
      </div>
      <div className="route-grid">
        {routes.map((r) => (
          <article key={key(r.from, r.to)} className="route-card">
            <header><strong>{zl(r.from)} <span aria-hidden="true">⇄</span> {zl(r.to)}</strong>
              <button type="button" className="icon-btn" onClick={() => remove(r)} aria-label={`Supprimer le trajet ${r.name}`}>×</button></header>
            {vehicles.map((v) => (
              <label key={v.key} className="route-price">
                <span>{v.label?.fr || v.key}<small>{v.maxPassengers} pers. · {v.maxLuggage} valises</small></span>
                <span className="money-inp"><input type="number" min="0" inputMode="decimal" value={price(r, v.key)} placeholder="—" onChange={(e) => setPrice(r, v.key, e.target.value)} aria-label={`${r.name} — ${v.label?.fr || v.key}`} /><i>€</i></span>
              </label>
            ))}
          </article>
        ))}
      </div>
      {routes.length === 0 && <p className="muted">Aucun trajet{q ? ' pour cette recherche' : ''}.</p>}
    </div>
  );
}

/* ======================= Véhicules ======================= */
function Vehicles({ cfg, update, set }) {
  const vehicles = cfg.vehicles || [];
  const confirm = useConfirm();
  const missing = STANDARD_VEHICLES.filter((x) => !vehicles.some((v) => v.key === x.key || (v.label?.fr || '').toLowerCase() === x.label.fr.toLowerCase()));
  function addStandard() { update({ ...cfg, vehicles: [...vehicles, ...missing.map((x) => ({ ...x, label: { ...x.label } }))] }); }
  function addVehicle() {
    update({ ...cfg, vehicles: [...vehicles, { key: `vehicule-${vehicles.length + 1}`, label: { fr: 'Nouveau véhicule' }, maxPassengers: 4, maxLuggage: 4, perKm: 1, minFare: 30 }] });
  }
  async function removeVehicle(i) {
    const v = vehicles[i];
    const n = cfg.grid.filter((g) => g.vehicle === v.key).length;
    if (!(await confirm({ title: `Supprimer le véhicule « ${v.label?.fr || v.key} » ?`, message: `Ses ${n} prix seront supprimés aussi (après « Enregistrer »).`, confirmLabel: 'Supprimer le véhicule' }))) return;
    update({ ...cfg, vehicles: vehicles.filter((_, k) => k !== i), grid: cfg.grid.filter((g) => g.vehicle !== v.key) });
  }
  return (
    <div className="stack">
      <p className="help">Le nom est saisi en français et traduit automatiquement. L’ordre compte : le premier véhicule sert de référence pour calculer les prix des nouveaux trajets.</p>
      {missing.length > 0 && (
        <div className="alert alert--info row" style={{ justifyContent: 'space-between' }}>
          <span>Véhicules standard absents : {missing.map((x) => x.label.fr).join(', ')}.</span>
          <button type="button" className="btn btn--outline btn-sm" onClick={addStandard}>Les ajouter</button>
        </div>
      )}
      <div className="route-grid">
        {vehicles.map((v, i) => (
          <article key={i} className="route-card">
            <header><strong>{v.label?.fr || 'Véhicule'}</strong><button type="button" className="icon-btn" onClick={() => removeVehicle(i)} aria-label="Supprimer le véhicule">×</button></header>
            <label className="lbl">Nom (français)<input className="inp" value={v.label?.fr || ''} onChange={(e) => set(`vehicles.${i}.label.fr`, e.target.value)} onBlur={(e) => { if (/^vehicule-\d+$/.test(v.key) && e.target.value) set(`vehicles.${i}.key`, slugify(e.target.value)); }} /></label>
            <div className="grid-2 grid-2--tight">
              <label className="lbl">Passagers max<input className="inp" type="number" min="1" value={v.maxPassengers ?? ''} onChange={(e) => set(`vehicles.${i}.maxPassengers`, +e.target.value)} /></label>
              <label className="lbl">Valises max<input className="inp" type="number" min="0" value={v.maxLuggage ?? ''} onChange={(e) => set(`vehicles.${i}.maxLuggage`, +e.target.value)} /></label>
              <label className="lbl">Prix au km (€)<input className="inp" type="number" step="0.1" min="0" value={v.perKm ?? ''} onChange={(e) => set(`vehicles.${i}.perKm`, +e.target.value)} /></label>
              <label className="lbl">Course minimum (€)<input className="inp" type="number" min="0" value={v.minFare ?? ''} onChange={(e) => set(`vehicles.${i}.minFare`, +e.target.value)} /></label>
            </div>
          </article>
        ))}
        <button type="button" className="route-card route-card--add" onClick={addVehicle}>+ Ajouter un véhicule</button>
      </div>
    </div>
  );
}

/* ======================= Suppléments et règles ======================= */
/** Champ nombre avec unité (défini hors du composant pour ne pas perdre le focus pendant la saisie) */
function NumField({ label, path, value, step, suffix, hint, set }) {
  return (
    <label className="lbl">{label}
      <span className="money-inp money-inp--wide"><input type="number" min="0" step={step || 1} value={value ?? ''} onChange={(e) => set(path, e.target.value === '' ? undefined : +e.target.value)} /><i>{suffix}</i></span>
      {hint && <small style={{ fontWeight: 400 }}>{hint}</small>}
    </label>
  );
}

function Extras({ cfg, set }) {
  const s = cfg.supplements || {};
  const N = (props) => NumField({ ...props, set });
  return (
    <div className="extras">
      <section className="panel stack"><h3>Nuit</h3>
        <p className="help">Supplément de <b>{s.nightPercent ?? 0} %</b> pour une prise en charge entre <b>{s.nightFrom ?? 22} h</b> et <b>{s.nightTo ?? 6} h</b>.</p>
        <div className="grid-3">
          {N({ label: "Supplément",  path: "supplements.nightPercent",  value: s.nightPercent,  suffix: "%" })}
          {N({ label: "À partir de",  path: "supplements.nightFrom",  value: s.nightFrom,  suffix: "h" })}
          {N({ label: "Jusqu’à",  path: "supplements.nightTo",  value: s.nightTo,  suffix: "h" })}
        </div>
      </section>
      <section className="panel stack"><h3>Options payantes</h3>
        <div className="grid-3">
          {N({ label: "Siège enfant",  path: "supplements.childSeat",  value: s.childSeat,  suffix: "€",  hint: "par siège" })}
          {N({ label: "Panneau à l’arrivée",  path: "supplements.nameSign",  value: s.nameSign,  suffix: "€",  hint: "0 = offert" })}
          {N({ label: "Arrêt supplémentaire",  path: "supplements.extraStop",  value: s.extraStop,  suffix: "€" })}
        </div>
      </section>
      <section className="panel stack"><h3>Attente à l’aéroport</h3>
        <div className="grid-2">
          {N({ label: "Attente offerte",  path: "supplements.includedWaitingMin",  value: s.includedWaitingMin,  suffix: "min" })}
          {N({ label: "Au-delà, par heure",  path: "supplements.waitingPerHour",  value: s.waitingPerHour,  suffix: "€" })}
        </div>
      </section>
      <section className="panel stack"><h3>Réservation</h3>
        <div className="grid-2">
          {N({ label: "Remise aller-retour",  path: "returnDiscount",  value: cfg.returnDiscount,  suffix: "%",  hint: "appliquée au trajet retour" })}
          {N({ label: "Réserver au moins",  path: "minNoticeHours",  value: cfg.minNoticeHours,  suffix: "h avant" })}
        </div>
      </section>
      <section className="panel stack"><h3>Mise à disposition (chauffeur à l’heure)</h3>
        <div className="grid-2">
          {N({ label: "Par heure",  path: "hourlyHire.pricePerHour",  value: cfg.hourlyHire?.pricePerHour,  suffix: "€" })}
          {N({ label: "Par journée",  path: "hourlyHire.pricePerDay",  value: cfg.hourlyHire?.pricePerDay,  suffix: "€" })}
        </div>
      </section>
    </div>
  );
}

/* ======================= Lieux et zones ======================= */
function Places({ data, zones, zl, reload, say, grid }) {
  const confirm = useConfirm();
  const [editLoc, setEditLoc] = useState(null);
  const [editZone, setEditZone] = useState(null);
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState({ name: '', type: 'hotel', zone: '' });
  const [zone, setZone] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const locations = data.locations || [];
  const needle = q.trim().toLowerCase();
  const byZone = zones.map((z) => ({ z, list: locations.filter((l) => l.zone === z.key && (!needle || l.name.toLowerCase().includes(needle) || (l.label?.fr || '').toLowerCase().includes(needle))) }))
    .filter((g) => !needle || g.list.length);
  async function removeLoc(l) {
    if (await confirm({ title: `Supprimer « ${l.label?.fr || l.name} » ?`, message: 'Ce lieu ne sera plus proposé aux clients dans la recherche de transfert. Les réservations déjà faites ne changent pas.', confirmLabel: 'Supprimer le lieu' })) {
      run(() => adminApi.del(`/locations/${l._id}`), 'Lieu supprimé').catch(() => {});
    }
  }
  async function removeZone(z, places) {
    const prices = (grid || []).filter((g) => g.fromZone === z.key || g.toZone === z.key).length;
    if (places || prices) {
      await confirm({ title: `Impossible de supprimer « ${zl(z.key)} »`, message: `Cette zone est encore utilisée par ${places} lieu(x) et ${prices} prix de trajet. Déplacez ou supprimez-les d’abord (et enregistrez les prix).`, confirmLabel: 'Compris', danger: false });
      return;
    }
    if (await confirm({ title: `Supprimer la zone « ${zl(z.key)} » ?`, confirmLabel: 'Supprimer la zone' })) run(() => adminApi.del(`/zones/${z._id}`), 'Zone supprimée').catch(() => {});
  }
  const run = async (fn, ok) => { setErr(null); setBusy(true); let done = false; try { await fn(); await reload(); say(ok); done = true; } catch (x) { setErr(x); } setBusy(false); if (!done) throw new Error('stop'); };

  return (
    <div className="stack">
      <p className="help">Les <b>lieux</b> sont proposés au client quand il tape son départ ou son arrivée (aéroport, ville, hôtel). Chaque lieu appartient à une <b>zone</b> : c’est la zone qui fixe le prix.</p>
      <Err error={err} />
      <div className="grid-2">
        <form className="panel stack" onSubmit={(e) => { e.preventDefault(); run(() => adminApi.post('/locations', { ...loc, label: { fr: loc.name } }), `Lieu ajouté : ${loc.name}`).then(() => setLoc({ name: '', type: loc.type, zone: loc.zone })).catch(() => {}); }}>
          <h3>Ajouter un lieu</h3>
          <label className="lbl">Nom<input className="inp" required placeholder="Ex. : Hôtel Riu Palace, Port El Kantaoui" value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} /></label>
          <div className="grid-2 grid-2--tight">
            <label className="lbl">Type<select className="inp" value={loc.type} onChange={(e) => setLoc({ ...loc, type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="lbl">Zone<select className="inp" required value={loc.zone} onChange={(e) => setLoc({ ...loc, zone: e.target.value })}><option value="">Choisir…</option>{zones.map((z) => <option key={z.key} value={z.key}>{z.label?.fr || z.key}</option>)}</select></label>
          </div>
          <button className="btn btn--green" disabled={busy}>Ajouter le lieu</button>
        </form>
        <form className="panel stack" onSubmit={(e) => { e.preventDefault(); run(() => adminApi.post('/zones', { label: { fr: zone } }), `Zone ajoutée : ${zone}`).then(() => setZone('')).catch(() => {}); }}>
          <h3>Ajouter une zone</h3>
          <label className="lbl">Nom de la zone<input className="inp" required placeholder="Ex. : Aéroport de Djerba, Hammamet Sud" value={zone} onChange={(e) => setZone(e.target.value)} /></label>
          <p className="help" style={{ margin: 0 }}>Une zone regroupe plusieurs lieux au même prix (ex. tous les hôtels de Sousse). Ajoutez ensuite ses prix dans « Prix des trajets ».</p>
          <button className="btn btn--green" disabled={busy}>Ajouter la zone</button>
        </form>
      </div>

      <input className="inp" type="search" placeholder="Rechercher un lieu…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un lieu" />
      {byZone.map(({ z, list }) => (
        <details key={z._id} className="panel zone-group" open={!!needle || list.length <= 6}>
          <summary><strong>{z.label?.fr || z.key}</strong> <span className="muted">· {list.length} lieu{list.length > 1 ? 'x' : ''}</span></summary>
          {editZone?._id === z._id ? (
            <form className="row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); run(() => adminApi.put(`/zones/${z._id}`, { label: { ...z.label, fr: editZone.name } }), 'Zone renommée et traduite').then(() => setEditZone(null)).catch(() => {}); }}>
              <input className="inp" required value={editZone.name} onChange={(e) => setEditZone({ ...editZone, name: e.target.value })} aria-label="Nom de la zone" style={{ flex: '1 1 200px' }} />
              <button className="btn btn--green btn-sm" disabled={busy}>Enregistrer</button>
              <button type="button" className="btn btn--outline btn-sm" onClick={() => setEditZone(null)}>Annuler</button>
            </form>
          ) : (
            <div className="actions" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
              <button type="button" className="btn btn--outline btn-sm" onClick={() => setEditZone({ _id: z._id, name: z.label?.fr || '' })}>Renommer la zone</button>
              <button type="button" className="btn btn--danger-outline btn-sm" disabled={busy} onClick={() => removeZone(z, list.length)}>Supprimer la zone</button>
            </div>
          )}
          <ul className="place-list">
            {list.map((l) => editLoc?._id === l._id ? (
              <li key={l._id}>
                <form className="edit-row" onSubmit={(e) => { e.preventDefault(); run(() => adminApi.put(`/locations/${l._id}`, { name: editLoc.name, type: editLoc.type, zone: editLoc.zone, label: { ...l.label, fr: editLoc.name } }), 'Lieu modifié').then(() => setEditLoc(null)).catch(() => {}); }}>
                  <input className="inp" required value={editLoc.name} onChange={(e) => setEditLoc({ ...editLoc, name: e.target.value })} aria-label="Nom du lieu" />
                  <select className="inp" value={editLoc.type} onChange={(e) => setEditLoc({ ...editLoc, type: e.target.value })} aria-label="Type">{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <select className="inp" value={editLoc.zone} onChange={(e) => setEditLoc({ ...editLoc, zone: e.target.value })} aria-label="Zone">{zones.map((x) => <option key={x.key} value={x.key}>{x.label?.fr || x.key}</option>)}</select>
                  <div className="actions"><button className="btn btn--green btn-sm" disabled={busy}>Enregistrer</button><button type="button" className="btn btn--outline btn-sm" onClick={() => setEditLoc(null)}>Annuler</button></div>
                </form>
              </li>
            ) : (
              <li key={l._id}>
                <span><span className={`type-tag type-${l.type}`}>{TYPES[l.type]}</span> {l.label?.fr || l.name}</span>
                <span className="actions">
                  <button type="button" className="btn btn--outline btn-sm" onClick={() => setEditLoc({ _id: l._id, name: l.label?.fr || l.name, type: l.type, zone: l.zone })}>Modifier</button>
                  <button type="button" className="icon-btn" disabled={busy} aria-label={`Supprimer ${l.name}`} onClick={() => removeLoc(l)}>×</button>
                </span>
              </li>
            ))}
          </ul>
          {list.length === 0 && <p className="muted" style={{ margin: '8px 0' }}>Aucun lieu dans cette zone.</p>}
        </details>
      ))}
    </div>
  );
}

/* ======================= Pages Google (pages de destination par trajet) ======================= */
function Pages({ data, zones, zl, reload, say }) {
  const confirm = useConfirm();
  const empty = { fromZone: '', toZone: '', title: { fr: '' }, description: { fr: '' }, published: true };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const routes = data.routes || [];
  async function submit(e) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const r = f._id ? await adminApi.put(`/transfer-routes/${f._id}`, f) : await adminApi.post('/transfer-routes', f);
      await reload(); setF(empty);
      say(r.translation?.error ? `Enregistré (${TRANSLATION_WARNING})` : 'Page enregistrée et traduite');
    } catch (x) { setErr(x); }
    setBusy(false);
  }
  return (
    <div className="stack">
      <p className="help">Une page par trajet important (ex. « Transfert aéroport Enfidha – Sousse ») aide à être trouvé sur Google. Titre et texte en français, traduits automatiquement.</p>
      <Err error={err} />
      <form className="panel stack" onSubmit={submit}>
        <h3>{f._id ? 'Modifier la page' : 'Nouvelle page'}</h3>
        <div className="grid-2 grid-2--tight">
          <label className="lbl">Départ<select className="inp" required value={f.fromZone} onChange={(e) => setF({ ...f, fromZone: e.target.value })}><option value="">Choisir…</option>{zones.map((z) => <option key={z.key} value={z.key}>{z.label?.fr || z.key}</option>)}</select></label>
          <label className="lbl">Arrivée<select className="inp" required value={f.toZone} onChange={(e) => setF({ ...f, toZone: e.target.value })}><option value="">Choisir…</option>{zones.map((z) => <option key={z.key} value={z.key}>{z.label?.fr || z.key}</option>)}</select></label>
        </div>
        <label className="lbl">Titre<input className="inp" required placeholder="Transfert aéroport Enfidha – Sousse" value={f.title?.fr || ''} onChange={(e) => setF({ ...f, title: { ...f.title, fr: e.target.value } })} /></label>
        <label className="lbl">Texte de présentation<textarea className="inp" rows={3} value={f.description?.fr || ''} onChange={(e) => setF({ ...f, description: { ...f.description, fr: e.target.value } })} /></label>
        <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={f.published !== false} onChange={(e) => setF({ ...f, published: e.target.checked })} />Page visible sur le site</label>
        <div className="row"><button className="btn btn--green" disabled={busy}>{busy ? 'Traduction…' : f._id ? 'Enregistrer' : 'Créer la page'}</button>{f._id && <button type="button" className="btn btn--outline" onClick={() => setF(empty)}>Annuler</button>}</div>
      </form>
      <ul className="place-list panel">
        {routes.map((r) => (
          <li key={r._id}>
            <span><strong>{r.title?.fr || `${zl(r.fromZone)} – ${zl(r.toZone)}`}</strong> <small className="muted">{r.published ? '· en ligne' : '· masquée'}</small></span>
            <span className="row" style={{ flexWrap: 'nowrap' }}>
              <button type="button" className="btn btn--outline btn-sm" onClick={() => { setF(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Modifier</button>
              <button type="button" className="icon-btn" aria-label="Supprimer la page" onClick={async () => { if (await confirm({ title: `Supprimer la page « ${r.title?.fr || ''} » ?`, message: 'La page disparaîtra du site et de Google dans toutes les langues.', confirmLabel: 'Supprimer la page' })) { await adminApi.del(`/transfer-routes/${r._id}`); if (f._id === r._id) setF(empty); reload(); say('Page supprimée'); } }}>×</button>
            </span>
          </li>
        ))}
        {routes.length === 0 && <li className="muted">Aucune page.</li>}
      </ul>
    </div>
  );
}
