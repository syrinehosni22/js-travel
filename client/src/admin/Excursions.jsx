import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { computeExcursionPrice, groupTable, minimumWarnings } from '@tt/shared';
import { seoScore, seoErrors, slugify } from '@tt/shared/seo';
import { adminApi, adminToken } from '../api.js';
import { useLoad, Top, Err, useToast, eur, LANGS, getPath, setPath, useConfirm, RemoveButton } from './shared.jsx';
import { useAdmin } from './AdminApp.jsx';

const CATS = { culture: 'Culture', desert: 'Désert', sea: 'Mer', adventure: 'Aventure', family: 'Famille' };
const CHECK_LABELS = {
  kwInTitle: 'Mot-clé dans le titre SEO', kwInSlug: 'Mot-clé dans l’URL', kwInH1: 'Mot-clé dans le H1', kwInFirstParagraph: 'Mot-clé dans le premier paragraphe',
  kwInAlt: 'Mot-clé dans un texte alternatif', titleLength: 'Titre SEO de 50 à 60 caractères', descriptionLength: 'Méta description de 140 à 160 caractères',
  h1DiffersFromTitle: 'H1 différent du titre SEO', textLength: 'Texte de 300 mots minimum', internalLinks: 'Liens internes présents',
};
const EMPTY_L = () => Object.fromEntries(LANGS.map((l) => [l, '']));

/* ======================= Liste ======================= */
export function ExcursionList() {
  const nav = useNavigate();
  const { data, error, reload } = useLoad(() => adminApi.get('/excursions'));
  async function create() {
    const r = await adminApi.post('/excursions', { title: { ...EMPTY_L(), fr: 'Nouvelle excursion' }, pricing: { mode: 'minimum', seasons: { low: {}, mid: {}, high: {} } } });
    nav(`/admin/excursions/${r.excursion._id}`);
  }
  async function duplicate(id) { const r = await adminApi.post(`/excursions/${id}/duplicate`); nav(`/admin/excursions/${r._id}`); }
  const remove = useDeleteExcursion();
  const [toast, say] = useToast();
  const { user } = useAdmin();
  const canDelete = ['admin', 'manager'].includes(user.role);
  return (
    <>
      <Top title="Excursions"><button className="btn btn--green" onClick={create}>+ Créer une excursion</button></Top>
      <Err error={error} />
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Excursion</th><th>Catégorie</th><th>Tarif</th><th>Publiée</th>{LANGS.map((l) => <th key={l}>{l.toUpperCase()}</th>)}<th></th></tr></thead>
          <tbody>{(data || []).map((e) => (
            <tr key={e._id}>
              <td><Link to={`/admin/excursions/${e._id}`}><strong>{e.title?.fr || e.title?.en || '(sans titre)'}</strong></Link>
                {e.warnings?.length > 0 && <div style={{ color: '#9B1C1C', fontSize: 12 }}>⚠ minimum inatteignable ({e.warnings.map((w) => w.season).join(', ')})</div>}</td>
              <td>{CATS[e.category] || '—'}</td>
              <td>{e.pricingMode}</td>
              <td>{e.published ? '✓' : '—'}</td>
              {LANGS.map((l) => (
                <td key={l} title={`Traduction : ${e.translation?.[l]} · SEO ${e.seo?.[l]?.score}/100, ${e.seo?.[l]?.missing} champ(s) manquant(s)`}>
                  <span className={`light light-${e.translation?.[l] === 'reviewed' && !e.seo?.[l]?.missing ? 'green' : e.translation?.[l] === 'missing' ? 'red' : 'orange'}`} />
                  {e.publishedLangs?.includes(l) && ' ●'}
                </td>
              ))}
              <td><div className="actions">
                <Link className="btn btn--outline btn-sm" to={`/admin/excursions/${e._id}`}>Modifier</Link>
                <button className="btn btn--outline btn-sm" onClick={() => duplicate(e._id)}>Dupliquer</button>
                {canDelete && <button className="btn btn--danger-outline btn-sm" onClick={async () => { if (await remove(e)) { reload(); say('Excursion supprimée'); } }}>Supprimer</button>}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Pastille : vert = traduit, relu et SEO complet · orange = à relire ou SEO incomplet · rouge = non traduit. ● = publiée dans cette langue.</p>
      </div>
      {toast}
    </>
  );
}

/** Suppression d'une excursion, avec confirmation et avertissement s'il reste des réservations à venir */
function useDeleteExcursion() {
  const confirm = useConfirm();
  return async (e) => {
    const name = e.title?.fr || e.title?.en || 'cette excursion';
    const { futureBookings = 0 } = await adminApi.get(`/excursions/${e._id}/usage`).catch(() => ({}));
    const ok = await confirm({
      title: `Supprimer « ${name} » ?`,
      message: futureBookings
        ? `Attention : ${futureBookings} réservation(s) à venir concernent cette excursion. Elles seront conservées, mais l’excursion disparaîtra du site dans toutes les langues. Pour la retirer temporairement, préférez « Dépublier ».`
        : 'L’excursion disparaîtra du site dans toutes les langues, avec ses photos, tarifs et textes. Pour la retirer temporairement, préférez « Dépublier ».',
      confirmLabel: 'Supprimer l’excursion',
    });
    if (!ok) return false;
    await adminApi.del(`/excursions/${e._id}`);
    return true;
  };
}

/* ======================= Éditeur ======================= */
/** Champ traduit affiché côte à côte (§6 : écran de traduction côte à côte) */
function Tr({ label, e, set, field, langs, area, hint }) {
  const Input = area ? 'textarea' : 'input';
  return (
    <div className={langs.length > 1 ? 'grid-2' : 'stack'}>
      {langs.map((l) => (
        <label key={l} className="lbl">{label}{langs.length > 1 ? ` · ${l.toUpperCase()}` : ''}{hint && langs.length === 1 && <small style={{ fontWeight: 400 }}>{hint}</small>}
          <Input className="inp" rows={area ? 6 : undefined} value={getPath(e, `${field}.${l}`) || ''} onChange={(ev) => set(`${field}.${l}`, ev.target.value)} />
        </label>
      ))}
    </div>
  );
}

/** Liste traduite (points forts, inclus…) : une ligne par élément */
function TrList({ label, e, set, field, langs }) {
  const list = e[field] || [];
  const text = (l) => list.map((x) => x?.[l] || '').join('\n');
  const update = (l, value) => {
    const lines = value.split('\n');
    const n = Math.max(lines.length, list.length);
    const next = [...Array(n)].map((_, i) => ({ ...EMPTY_L(), ...(list[i] || {}), [l]: lines[i] ?? '' }))
      .filter((x) => LANGS.some((k) => x[k]));
    set(field, next);
  };
  return (
    <div className={langs.length > 1 ? 'grid-2' : 'stack'}>
      {langs.map((l) => <label key={l} className="lbl">{label}{langs.length > 1 ? ` · ${l.toUpperCase()}` : ''} — une ligne par élément<textarea className="inp" rows={4} value={text(l)} onChange={(ev) => update(l, ev.target.value)} /></label>)}
    </div>
  );
}

const LANG_FR = { en: 'Anglais', fr: 'Français', de: 'Allemand', it: 'Italien', es: 'Espagnol' };
const STATUS_FR = { missing: 'Non traduit', auto: 'Traduit automatiquement', reviewed: 'Relu' };

/** Bandeau : comment fonctionne la traduction automatique + état de chaque langue */
function TranslationBar({ e, set, onRetranslate, busy }) {
  const [info, setInfo] = useState(null);
  useEffect(() => { adminApi.get('/translate/status').then(setInfo).catch(() => {}); }, []);
  return (
    <div className="tr-bar">
      <div>
        <strong>Saisissez uniquement en français.</strong> À l’enregistrement, l’anglais, l’allemand, l’italien et l’espagnol sont remplis automatiquement
        {info?.provider === 'deepl' && ' (DeepL).'}
        {info?.provider === 'mymemory' && <> (service gratuit limité. Pour une meilleure qualité, ajoutez une clé DeepL gratuite : <code>DEEPL_API_KEY</code> dans <code>server/.env</code>).</>}
        {info?.provider === 'off' && <> — <b>désactivé</b> (TRANSLATE_PROVIDER=off).</>}
        {!info && '.'}
        <div className="tr-langs">
          {LANGS.filter((l) => l !== 'fr').map((l) => (
            <label key={l} className={`tr-chip tr-${e.translation?.[l] || 'missing'}`}>
              {LANG_FR[l]}
              <select value={e.translation?.[l] || 'missing'} onChange={(ev) => set(`translation.${l}`, ev.target.value)} aria-label={`Statut ${LANG_FR[l]}`}>
                {Object.entries(STATUS_FR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          ))}
        </div>
        <small className="muted">« Relu » = la traduction ne sera plus remplacée quand vous modifiez le français.</small>
      </div>
      <button type="button" className="btn btn--outline btn-sm" disabled={busy} onClick={onRetranslate}>{busy ? 'Traduction…' : '↻ Retraduire tout depuis le français'}</button>
    </div>
  );
}

function ContentTab({ e, set, onRetranslate, busy }) {
  const [show, setShow] = useState(false);
  const [other, setOther] = useState('en');
  const langs = show ? ['fr', other] : ['fr'];
  const P = { e, set, langs };
  return (
    <div className="stack">
      <TranslationBar e={e} set={set} onRetranslate={onRetranslate} busy={busy} />
      <div className="row">
        <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={show} onChange={(ev) => setShow(ev.target.checked)} />Voir et corriger les traductions</label>
        {show && <select className="inp" value={other} onChange={(ev) => setOther(ev.target.value)} aria-label="Langue à afficher">{LANGS.filter((l) => l !== 'fr').map((l) => <option key={l} value={l}>{LANG_FR[l]}</option>)}</select>}
      </div>

      <section className="form-sec"><h3>1. L’essentiel</h3>
        <Tr label="Titre de l’excursion" field="title" hint="Ex. : Excursion privée Carthage et Sidi Bou Saïd" {...P} />
        <Tr label="Résumé (2 lignes, affiché sous le titre et sur les cartes)" field="summary" area {...P} />
        <Tr label="Durée affichée" field="durationLabel" hint="Ex. : Journée, 4 heures, 2 jours" {...P} />
      </section>
      <section className="form-sec"><h3>2. Ce que vivent les voyageurs</h3>
        <TrList label="Points forts" field="highlights" {...P} />
        <Tr label="Description complète" field="description" area {...P} />
      </section>
      <section className="form-sec"><h3>3. Inclus / non inclus</h3>
        <div className="grid-2">
          <TrList label="Inclus" field="included" {...P} />
          <TrList label="Non inclus" field="notIncluded" {...P} />
        </div>
      </section>
      <section className="form-sec"><h3>4. Programme de la journée</h3>
        {(e.program || []).map((p, i) => (
          <div key={i} className="prog-row">
            <label className="lbl">Heure<input className="inp" value={p.time || ''} placeholder="08:00" onChange={(ev) => set(`program.${i}.time`, ev.target.value)} /></label>
            {langs.map((l) => <label key={l} className="lbl" style={{ flex: 1 }}>Étape{langs.length > 1 ? ` · ${l.toUpperCase()}` : ''}<input className="inp" value={p.text?.[l] || ''} onChange={(ev) => set(`program.${i}.text.${l}`, ev.target.value)} /></label>)}
            <RemoveButton what="cette étape" onConfirm={() => set('program', e.program.filter((_, k) => k !== i))} />
          </div>
        ))}
        <button type="button" className="link-btn" onClick={() => set('program', [...(e.program || []), { time: '', text: EMPTY_L() }])}>+ Ajouter une étape</button>
      </section>
      <section className="form-sec"><h3>5. Informations importantes</h3>
        <TrList label="À apporter" field="toBring" {...P} />
      </section>
      <section className="form-sec"><h3>6. Questions fréquentes</h3>
        {(e.faq || []).map((f, i) => (
          <div key={i} className={langs.length > 1 ? 'grid-2' : 'stack'}>
            {langs.map((l) => <div key={l} className="stack" style={{ gap: 6 }}>
              <input className="inp" placeholder={`Question${langs.length > 1 ? ` ${l.toUpperCase()}` : ''}`} value={f.q?.[l] || ''} onChange={(ev) => set(`faq.${i}.q.${l}`, ev.target.value)} />
              <textarea className="inp" placeholder={`Réponse${langs.length > 1 ? ` ${l.toUpperCase()}` : ''}`} value={f.a?.[l] || ''} onChange={(ev) => set(`faq.${i}.a.${l}`, ev.target.value)} />
            </div>)}
            <RemoveButton what="cette question" className="link-btn" label="Supprimer cette question" onConfirm={() => set('faq', e.faq.filter((_, k) => k !== i))} />
          </div>
        ))}
        <button type="button" className="link-btn" onClick={() => set('faq', [...(e.faq || []), { q: EMPTY_L(), a: EMPTY_L() }])}>+ Ajouter une question</button>
      </section>
    </div>
  );
}

function InfoTab({ e, set }) {
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  async function upload(files) {
    setUploading(true);
    const fd = new FormData();
    [...files].forEach((f) => fd.append('files', f));
    const res = await fetch('/api/admin/uploads', { method: 'POST', headers: { Authorization: `Bearer ${adminToken.get()}` }, body: fd }).then((r) => r.json());
    set('images', [...(e.images || []), ...res.filter((x) => !x.name.endsWith('.mp4')).map((x) => ({ url: x.url, alt: { ...EMPTY_L(), fr: e.title?.fr || '' } }))]);
    const video = res.find((x) => x.name.endsWith('.mp4'));
    if (video) set('video', video.url);
    setUploading(false);
  }
  const csv = (v) => (v || []).join(', ');
  const parse = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
  return (
    <div className="stack">
      <div className="grid-3">
        <label className="lbl">Catégorie<select className="inp" value={e.category || ''} onChange={(ev) => set('category', ev.target.value)}><option value="">—</option>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="lbl">Durée (heures, pour les filtres)<input className="inp" type="number" value={e.durationHours || ''} onChange={(ev) => set('durationHours', +ev.target.value)} /></label>
        <label className="lbl">Âge minimum<input className="inp" type="number" value={e.minAge || 0} onChange={(ev) => set('minAge', +ev.target.value)} /></label>
        <label className="lbl">Villes de départ (séparées par des virgules)<input className="inp" value={csv(e.departureCities)} onChange={(ev) => set('departureCities', parse(ev.target.value))} /></label>
        <label className="lbl">Langues du guide<input className="inp" value={csv(e.guideLanguages)} onChange={(ev) => set('guideLanguages', parse(ev.target.value))} placeholder="fr, en, de" /></label>
        <label className="lbl">Horaires de départ<input className="inp" value={csv(e.startTimes)} onChange={(ev) => set('startTimes', parse(ev.target.value))} placeholder="08:00" /></label>
      </div>
      <div className="row">
        {['private', 'family', 'bestseller', 'new'].map((b) => (
          <label key={b} className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={(e.badges || []).includes(b)} onChange={(ev) => set('badges', ev.target.checked ? [...(e.badges || []), b] : e.badges.filter((x) => x !== b))} />{b}</label>
        ))}
      </div>
      <div className={`panel stack`} style={{ borderStyle: 'dashed', borderWidth: 2, borderColor: drag ? 'var(--green)' : 'var(--line)' }}
        onDragOver={(ev) => { ev.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(ev) => { ev.preventDefault(); setDrag(false); upload(ev.dataTransfer.files); }}>
        <strong>Photos et vidéo</strong>
        <p className="muted">Glissez-déposez vos fichiers ici (JPG, PNG, WebP, MP4 · 8 Mo max) ou <label className="link-btn" style={{ display: 'inline' }}>choisissez-les<input type="file" multiple accept="image/*,video/mp4" hidden onChange={(ev) => upload(ev.target.files)} /></label>. La première photo est l’image principale.</p>
        {uploading && <p>Envoi…</p>}
        <div className="grid-3">
          {(e.images || []).map((img, i) => (
            <div key={i} className="stack" style={{ gap: 6 }}>
              <div className="media" style={{ height: 120, borderRadius: 12 }}><img src={img.url} alt="" /></div>
              <input className="inp" placeholder="Description de la photo (français)" aria-label="Description de la photo" value={img.alt?.fr || ''} onChange={(ev) => set(`images.${i}.alt.fr`, ev.target.value)} />
              <div className="row">
                {i > 0 && <button type="button" className="btn btn--outline btn-sm" onClick={() => { const a = [...e.images]; [a[0], a[i]] = [a[i], a[0]]; set('images', a); }}>Image principale</button>}
                <RemoveButton what="cette photo" className="btn btn--danger-outline btn-sm" label="Supprimer" onConfirm={() => set('images', e.images.filter((_, k) => k !== i))} />
              </div>
            </div>
          ))}
        </div>
        {e.video && <p>Vidéo : {e.video} <RemoveButton what="la vidéo" className="link-btn" label="retirer" onConfirm={() => set('video', '')} /></p>}
      </div>
      <label className="lbl">Carte du parcours (URL d’intégration Google Maps)<input className="inp" value={e.mapEmbed || ''} onChange={(ev) => set('mapEmbed', ev.target.value)} /></label>
    </div>
  );
}

/** Tarifs + simulateur (§3.6) */
function PricingTab({ e, set, id }) {
  const pr = e.pricing || {};
  const P = (k) => `pricing.${k}`;
  const [sim, setSim] = useState({ season: 'high', adult: 4, child: 1, infant: 0, zone: '', options: [], discount: 0 });
  const [history, setHistory] = useState(null);
  const simResult = useMemo(() => computeExcursionPrice(e, { date: undefined, participants: { adult: sim.adult, child: sim.child, infant: sim.infant }, zone: sim.zone, options: sim.options },
    { calendar: { seasons: [{ name: sim.season, from: '01-01', to: '12-31' }] }, discount: { rate: sim.discount / 100, source: 'simulation' }, lang: 'fr' }), [e, sim]);
  const warnings = minimumWarnings(e);
  const seasonsLbl = { low: 'Basse saison', mid: 'Moyenne saison', high: 'Haute saison' };

  return (
    <div className="stack">
      <div className="grid-3">
        <label className="lbl">Mode de tarification
          <select className="inp" value={pr.mode} onChange={(ev) => set(P('mode'), ev.target.value)}>
            <option value="minimum">Minimum garanti + prix réduit</option><option value="per_person">Par personne</option>
            <option value="per_vehicle">Par véhicule</option><option value="group_flat">Forfait groupe</option><option value="quote">Sur devis</option>
          </select>
        </label>
        <label className="lbl">Capacité maximale (personnes)<input className="inp" type="number" value={pr.maxGroup ?? 8} onChange={(ev) => set(P('maxGroup'), +ev.target.value)} /></label>
        <label className="lbl">Supplément week-end (%)<input className="inp" type="number" value={pr.weekendSupplement ?? 0} onChange={(ev) => set(P('weekendSupplement'), +ev.target.value)} /></label>
      </div>

      {pr.mode !== 'quote' && (
        <div className="panel tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Saison</th>
              {pr.mode === 'minimum' && <th>Minimum garanti M (€)</th>}
              {['minimum', 'per_person'].includes(pr.mode) && <th>Prix réduit p (€ / adulte)</th>}
              {pr.mode === 'minimum' && <th>Seuil ⌈M / p⌉</th>}
              {pr.mode === 'per_vehicle' && <th>Prix par véhicule (€)</th>}
              {pr.mode === 'group_flat' && <th>Forfait (€)</th>}
            </tr></thead>
            <tbody>{['low', 'mid', 'high'].map((s) => {
              const v = pr.seasons?.[s] || {};
              return (
                <tr key={s}><td>{seasonsLbl[s]}</td>
                  {pr.mode === 'minimum' && <td><input type="number" value={v.minimum ?? ''} onChange={(ev) => set(P(`seasons.${s}.minimum`), +ev.target.value)} /></td>}
                  {['minimum', 'per_person'].includes(pr.mode) && <td><input type="number" value={v.adult ?? ''} onChange={(ev) => set(P(`seasons.${s}.adult`), +ev.target.value)} /></td>}
                  {pr.mode === 'minimum' && <td>{v.minimum && v.adult ? `${Math.ceil(v.minimum / v.adult)} pers.` : '—'}</td>}
                  {pr.mode === 'per_vehicle' && <td><input type="number" value={v.vehicle ?? ''} onChange={(ev) => set(P(`seasons.${s}.vehicle`), +ev.target.value)} /></td>}
                  {pr.mode === 'group_flat' && <td><input type="number" value={v.flat ?? ''} onChange={(ev) => set(P(`seasons.${s}.flat`), +ev.target.value)} /></td>}
                </tr>
              );
            })}</tbody>
          </table>
          {warnings.map((w) => <div key={w.season} className="alert alert--warn" style={{ marginTop: 8 }}>⚠ {seasonsLbl[w.season]} : le minimum ne peut pas être atteint avec la capacité maximale ({w.message}).</div>)}
        </div>
      )}
      {pr.mode === 'per_vehicle' && <label className="lbl">Capacité d’un véhicule<input className="inp" type="number" value={pr.vehicle?.capacity ?? 8} onChange={(ev) => set(P('vehicle.capacity'), +ev.target.value)} /></label>}
      {pr.mode === 'group_flat' && <div className="grid-2">
        <label className="lbl">Forfait jusqu’à N personnes<input className="inp" type="number" value={pr.flat?.upTo ?? ''} onChange={(ev) => set(P('flat.upTo'), +ev.target.value)} /></label>
        <label className="lbl">Supplément par personne au-delà (€)<input className="inp" type="number" value={pr.flat?.extraPerPerson ?? ''} onChange={(ev) => set(P('flat.extraPerPerson'), +ev.target.value)} /></label>
      </div>}

      <div className="grid-3">
        <label className="lbl">Réduction enfant (0,5 = −50 %)<input className="inp" type="number" step="0.05" value={pr.childDiscount ?? 0.5} onChange={(ev) => set(P('childDiscount'), +ev.target.value)} /></label>
        <label className="lbl">Âges enfant (de, à)<input className="inp" value={(pr.childAges || [4, 11]).join(',')} onChange={(ev) => set(P('childAges'), ev.target.value.split(',').map(Number))} /></label>
        <label className="lbl">Réduction bébé (1 = gratuit)<input className="inp" type="number" step="0.05" value={pr.infantDiscount ?? 1} onChange={(ev) => set(P('infantDiscount'), +ev.target.value)} /></label>
      </div>

      <fieldset className="panel stack"><legend><strong>Zones de prise en charge</strong></legend>
        {(pr.zones || []).map((z, i) => (
          <div key={i} className="row">
            <input className="inp" placeholder="clé (ex. hammamet)" value={z.key} onChange={(ev) => set(P(`zones.${i}.key`), ev.target.value)} />
            <input className="inp" placeholder="Libellé" value={z.label || ''} onChange={(ev) => set(P(`zones.${i}.label`), ev.target.value)} />
            <input className="inp" type="number" placeholder="Supplément €" value={z.fee ?? 0} onChange={(ev) => set(P(`zones.${i}.fee`), +ev.target.value)} style={{ width: 120 }} />
            <RemoveButton what="cette zone de prise en charge" onConfirm={() => set(P('zones'), pr.zones.filter((_, k) => k !== i))} />
          </div>
        ))}
        <button type="button" className="link-btn" onClick={() => set(P('zones'), [...(pr.zones || []), { key: '', label: '', fee: 0 }])}>+ Zone</button>
      </fieldset>

      <fieldset className="panel stack"><legend><strong>Supplément selon la langue du guide</strong></legend>
        {(pr.guideLanguages || []).map((g, i) => (
          <div key={i} className="row">
            <select className="inp" value={g.lang} onChange={(ev) => set(P(`guideLanguages.${i}.lang`), ev.target.value)}>{LANGS.map((l) => <option key={l}>{l}</option>)}</select>
            <input className="inp" type="number" value={g.fee ?? 0} onChange={(ev) => set(P(`guideLanguages.${i}.fee`), +ev.target.value)} style={{ width: 120 }} />
            <RemoveButton what="ce supplément de langue" onConfirm={() => set(P('guideLanguages'), pr.guideLanguages.filter((_, k) => k !== i))} />
          </div>
        ))}
        <button type="button" className="link-btn" onClick={() => set(P('guideLanguages'), [...(pr.guideLanguages || []), { lang: 'de', fee: 0 }])}>+ Langue</button>
      </fieldset>

      <fieldset className="panel stack"><legend><strong>Options</strong></legend>
        {(pr.options || []).map((o, i) => (
          <div key={i} className="row">
            <input className="inp" placeholder="code (ex. dejeuner)" value={o.key} onChange={(ev) => set(P(`options.${i}.key`), ev.target.value)} style={{ width: 140 }} />
            <input className="inp" placeholder="Nom de l’option (français)" value={o.label?.fr || ''} onChange={(ev) => set(P(`options.${i}.label.fr`), ev.target.value)} style={{ flex: '2 1 200px' }} />
            <input className="inp" type="number" placeholder="€" value={o.price ?? ''} onChange={(ev) => set(P(`options.${i}.price`), +ev.target.value)} style={{ width: 100 }} />
            <select className="inp" value={o.per || 'person'} onChange={(ev) => set(P(`options.${i}.per`), ev.target.value)}><option value="person">par personne</option><option value="vehicle">par véhicule</option><option value="booking">par réservation</option></select>
            <RemoveButton what="cette option" onConfirm={() => set(P('options'), pr.options.filter((_, k) => k !== i))} />
          </div>
        ))}
        <button type="button" className="link-btn" onClick={() => set(P('options'), [...(pr.options || []), { key: '', label: EMPTY_L(), price: 0, per: 'person' }])}>+ Option</button>
      </fieldset>

      {pr.mode !== 'quote' && (
        <div className="grid-2">
          <section className="panel stack">
            <h3>Simulateur</h3>
            <div className="grid-3">
              <label className="lbl">Saison<select className="inp" value={sim.season} onChange={(ev) => setSim({ ...sim, season: ev.target.value })}><option value="low">Basse</option><option value="mid">Moyenne</option><option value="high">Haute</option></select></label>
              <label className="lbl">Adultes<input className="inp" type="number" min="1" value={sim.adult} onChange={(ev) => setSim({ ...sim, adult: +ev.target.value })} /></label>
              <label className="lbl">Enfants<input className="inp" type="number" min="0" value={sim.child} onChange={(ev) => setSim({ ...sim, child: +ev.target.value })} /></label>
              <label className="lbl">Zone<select className="inp" value={sim.zone} onChange={(ev) => setSim({ ...sim, zone: ev.target.value })}><option value="">—</option>{(pr.zones || []).map((z) => <option key={z.key} value={z.key}>{z.label || z.key}</option>)}</select></label>
              <label className="lbl">Remise %<input className="inp" type="number" value={sim.discount} onChange={(ev) => setSim({ ...sim, discount: +ev.target.value })} /></label>
            </div>
            <div className="row">{(pr.options || []).map((o) => <label key={o.key} className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={sim.options.includes(o.key)} onChange={(ev) => setSim({ ...sim, options: ev.target.checked ? [...sim.options, o.key] : sim.options.filter((x) => x !== o.key) })} />{o.label?.fr || o.key}</label>)}</div>
            {simResult.quote ? <p className="alert alert--info">Bascule sur devis{simResult.overCapacity ? ' (capacité dépassée)' : ''}</p> : (
              <>
                <div className="lines">{simResult.lines.map((l, i) => <div key={i}><span>{l.key}{l.qty ? ` × ${l.qty}` : ''} {l.label || ''}</span><span>{eur(l.amount)}</span></div>)}</div>
                <strong style={{ fontSize: 22 }}>{eur(simResult.totalEur)} · {eur(simResult.perPerson)} / pers.</strong>
                {simResult.belowThreshold && <span className="alert alert--warn">Plus que {simResult.missing} pour le prix réduit</span>}
              </>
            )}
          </section>
          <section className="panel">
            <h3>Prix par taille de groupe ({sim.season === 'low' ? 'basse' : sim.season === 'mid' ? 'moyenne' : 'haute'} saison)</h3>
            <table className="tbl"><thead><tr><th>Pers.</th><th>Base</th><th>Prix / pers.</th></tr></thead>
              <tbody>{groupTable(e, sim.season).map((r) => <tr key={r.n}><td>{r.n}</td><td>{eur(r.base)}{r.minimumApplied ? ' (minimum)' : ''}</td><td>{eur(r.perPerson)}</td></tr>)}</tbody></table>
          </section>
        </div>
      )}
      {id && <div>
        <button type="button" className="link-btn" onClick={() => adminApi.get(`/pricing/history/${id}`).then(setHistory)}>Historique des changements de prix</button>
        {history && <ul className="muted" style={{ fontSize: 13 }}>{history.length === 0 && <li>Aucun changement.</li>}{history.map((h) => <li key={h._id}>{new Date(h.createdAt).toLocaleString('fr-FR')} · {h.userName} · haute saison : {h.before?.seasons?.high?.adult} → {h.after?.seasons?.high?.adult} € / M {h.before?.seasons?.high?.minimum} → {h.after?.seasons?.high?.minimum}</li>)}</ul>}
      </div>}
    </div>
  );
}

function AvailabilityTab({ e, set }) {
  const a = e.availability || {};
  const [d, setD] = useState('');
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return (
    <div className="stack">
      <div className="grid-3">
        <label className="lbl">Confirmation<select className="inp" value={a.mode || 'request'} onChange={(ev) => set('availability.mode', ev.target.value)}><option value="instant">Instantanée</option><option value="request">Sur demande</option></select></label>
        <label className="lbl">Validation sous (heures)<input className="inp" type="number" value={a.confirmWithinHours ?? 12} onChange={(ev) => set('availability.confirmWithinHours', +ev.target.value)} /></label>
        <label className="lbl">Groupes par jour (capacité)<input className="inp" type="number" value={a.capacityPerDay ?? 3} onChange={(ev) => set('availability.capacityPerDay', +ev.target.value)} /></label>
        <label className="lbl">Délai minimum de réservation (h)<input className="inp" type="number" value={a.minNoticeHours ?? 24} onChange={(ev) => set('availability.minNoticeHours', +ev.target.value)} /></label>
        <label className="lbl">Annulation gratuite jusqu’à (h avant)<input className="inp" type="number" value={e.cancellationFreeHours ?? 24} onChange={(ev) => set('cancellationFreeHours', +ev.target.value)} /></label>
      </div>
      <div><strong>Jours fermés chaque semaine</strong><div className="row">{days.map((n, i) => (
        <label key={i} className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={(a.closedWeekdays || []).includes(i)} onChange={(ev) => set('availability.closedWeekdays', ev.target.checked ? [...(a.closedWeekdays || []), i] : a.closedWeekdays.filter((x) => x !== i))} />{n}</label>
      ))}</div></div>
      <div className="stack"><strong>Dates bloquées</strong>
        <div className="row"><input className="inp" type="date" value={d} onChange={(ev) => setD(ev.target.value)} /><button type="button" className="btn btn--green btn-sm" onClick={() => d && set('availability.blockedDates', [...new Set([...(a.blockedDates || []), d])].sort())}>Bloquer cette date</button></div>
        <div className="row">{(a.blockedDates || []).map((x) => <RemoveButton key={x} what={`la date bloquée ${x}`} className="chip" label={`${x} ×`} onConfirm={() => set('availability.blockedDates', a.blockedDates.filter((y) => y !== x))} />)}</div>
      </div>
    </div>
  );
}

/** Onglet SEO par langue (§8.2) : compteurs, aperçu Google, score et corrections */
function SeoTab({ e, set }) {
  const [l, setL] = useState('fr');
  const [mobile, setMobile] = useState(false);
  const s = e.seo?.[l] || {};
  const F = (k) => `seo.${l}.${k}`;
  const score = seoScore(e, l);
  const missing = seoErrors(e, l);
  const len = (v, a, b) => <span className={`counter-hint ${(v || '').length >= a && (v || '').length <= b ? 'ok' : 'bad'}`}>{(v || '').length} / {a}–{b}</span>;
  function prefill() {
    const title = e.title?.[l] || '';
    const summary = e.summary?.[l] || '';
    const kw = s.focusKeyword || title.toLowerCase();
    let next = e;
    if (!s.focusKeyword) next = setPath(next, F('focusKeyword'), kw);
    if (!s.metaTitle) next = setPath(next, F('metaTitle'), title.slice(0, 60));
    if (!s.metaDescription) next = setPath(next, F('metaDescription'), summary.slice(0, 158));
    if (!s.h1) next = setPath(next, F('h1'), title);
    if (!e.slug?.[l]) next = setPath(next, `slug.${l}`, slugify(title));
    set(null, next);
  }
  return (
    <div className="grid-2">
      <div className="stack">
        <div className="tabs">{LANGS.map((x) => <button type="button" key={x} aria-selected={x === l} onClick={() => setL(x)}>{x.toUpperCase()} {seoErrors(e, x).length ? '•' : '✓'}</button>)}</div>
        <button type="button" className="btn btn--outline btn-sm" onClick={prefill}>Pré-remplir depuis le titre et le résumé</button>
        <label className="lbl">Mot-clé principal *<input className="inp" value={s.focusKeyword || ''} onChange={(ev) => set(F('focusKeyword'), ev.target.value)} /></label>
        <label className="lbl">Mots-clés secondaires (3 à 5, séparés par des virgules)<input className="inp" value={(s.secondaryKeywords || []).join(', ')} onChange={(ev) => set(F('secondaryKeywords'), ev.target.value.split(',').map((x) => x.trim()).filter(Boolean))} /></label>
        <label className="lbl">Titre SEO * {len(s.metaTitle, 50, 60)}<input className="inp" value={s.metaTitle || ''} onChange={(ev) => set(F('metaTitle'), ev.target.value)} /></label>
        <label className="lbl">Méta description * {len(s.metaDescription, 140, 160)}<textarea className="inp" rows={3} value={s.metaDescription || ''} onChange={(ev) => set(F('metaDescription'), ev.target.value)} /></label>
        <label className="lbl">URL (slug) *<input className="inp" value={e.slug?.[l] || ''} onChange={(ev) => set(`slug.${l}`, ev.target.value)} onBlur={(ev) => set(`slug.${l}`, slugify(ev.target.value))} /><small>Redirection 301 automatique si l’URL change après publication.</small></label>
        <label className="lbl">Titre H1 *<input className="inp" value={s.h1 || ''} onChange={(ev) => set(F('h1'), ev.target.value)} /></label>
        <details><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Partage et options avancées</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <label className="lbl">Image de partage (1200 × 630)<input className="inp" value={s.ogImage || ''} onChange={(ev) => set(F('ogImage'), ev.target.value)} placeholder="image principale par défaut" /></label>
            <label className="lbl">Titre de partage<input className="inp" value={s.ogTitle || ''} onChange={(ev) => set(F('ogTitle'), ev.target.value)} placeholder="= titre SEO" /></label>
            <label className="lbl">Description de partage<input className="inp" value={s.ogDescription || ''} onChange={(ev) => set(F('ogDescription'), ev.target.value)} placeholder="= méta description" /></label>
            <label className="lbl">URL canonique<input className="inp" value={s.canonical || ''} onChange={(ev) => set(F('canonical'), ev.target.value)} placeholder="automatique" /></label>
            <label className="check"><input type="checkbox" checked={s.index !== false} onChange={(ev) => set(F('index'), ev.target.checked)} />Afficher dans Google (indexation)</label>
          </div>
        </details>
      </div>
      <div className="stack">
        <section className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}><strong>Aperçu Google</strong>
            <div className="tabs" style={{ margin: 0, border: 0 }}><button type="button" aria-selected={!mobile} onClick={() => setMobile(false)}>Ordinateur</button><button type="button" aria-selected={mobile} onClick={() => setMobile(true)}>Mobile</button></div></div>
          <div className="gpreview" style={{ maxWidth: mobile ? 360 : 600 }}>
            <div className="u">{location.host} › {l} › excursions › {e.slug?.[l]}</div>
            <div className="t">{(s.metaTitle || e.title?.[l] || '').slice(0, mobile ? 70 : 60)}{(s.metaTitle || '').length > 60 ? '…' : ''}</div>
            <div className="d">{(s.metaDescription || '').slice(0, mobile ? 120 : 160)}</div>
          </div>
        </section>
        <section className="panel stack">
          <div className="row"><span className={`light light-${score.light}`} /><strong>Score SEO {score.score}/100</strong></div>
          {missing.length > 0 && <div className="alert alert--warn">Champs obligatoires manquants : {missing.join(', ')} — publication bloquée dans cette langue.</div>}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {score.checks.map((c) => <li key={c.key}><span className={`light light-${c.ok ? 'green' : 'red'}`} /> {CHECK_LABELS[c.key]}{c.value != null ? ` (${c.value})` : ''}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function ExcursionEdit() {
  const { id } = useParams();
  const navTo = useNavigate();
  const remove = useDeleteExcursion();
  const { user } = useAdmin();
  const canDelete = ['admin', 'manager'].includes(user.role);
  const { data, error } = useLoad(() => adminApi.get(`/excursions/${id}`), [id]);
  const [e, setE] = useState(null);
  const [tab, setTab] = useState('content');
  const [saveErr, setSaveErr] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [toast, say] = useToast();
  useEffect(() => { if (data) { setE(data); setDirty(false); } }, [data]);
  useEffect(() => {
    const warn = (ev) => { if (dirty) { ev.preventDefault(); ev.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (p, v) => { setDirty(true); setE((cur) => (p === null ? v : setPath(cur, p, v))); };
  const [busy, setBusy] = useState(false);
  const [trWarn, setTrWarn] = useState('');
  async function save(extra = {}) {
    setSaveErr(null); setBusy(true); setTrWarn('');
    try {
      const r = await adminApi.put(`/excursions/${id}`, { ...e, ...extra });
      setE({ ...r.excursion, seoReport: r.seoReport }); setConflicts(r.conflicts || []); setDirty(false);
      const langs = Object.keys(r.translation?.languages || {});
      if (r.translation?.error) setTrWarn(`Enregistré, mais la traduction automatique a échoué : ${r.translation.error}`);
      say(langs.length ? `Enregistré · traduit en ${langs.map((l) => l.toUpperCase()).join(', ')}` : 'Enregistré');
    } catch (x) { setSaveErr(x); }
    setBusy(false);
  }
  if (error) return <Err error={error} />;
  if (!e) return <p>Chargement…</p>;
  const TABS = { content: 'Textes', info: 'Infos et photos', pricing: 'Tarifs', availability: 'Disponibilités', seo: 'SEO', publish: 'Publication' };
  return (
    <>
      <Top title={e.title?.fr || e.title?.en || 'Excursion'}>
        <Link to="/admin/excursions" className="btn btn--outline btn-sm">← Liste</Link>
        <button className="btn btn--green" onClick={() => save()} disabled={!dirty || busy}>{busy ? 'Enregistrement et traduction…' : 'Enregistrer'}</button>
      </Top>
      <div className="tabs" role="tablist">{Object.entries(TABS).map(([k, v]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{v}</button>)}</div>
      <Err error={saveErr} />
      {trWarn && <div className="alert alert--warn" style={{ marginBottom: 12 }}>{trWarn}</div>}
      {conflicts.length > 0 && <div className="alert alert--warn" style={{ marginBottom: 12 }}>Mot-clé déjà utilisé par une autre fiche : {conflicts.map((c) => `${c.lang.toUpperCase()} « ${c.keyword} »`).join(', ')}</div>}
      <div className="panel">
        {tab === 'content' && <ContentTab e={e} set={set} busy={busy} onRetranslate={() => save({ _retranslate: true })} />}
        {tab === 'info' && <InfoTab e={e} set={set} />}
        {tab === 'pricing' && <PricingTab e={e} set={set} id={id} />}
        {tab === 'availability' && <AvailabilityTab e={e} set={set} />}
        {tab === 'seo' && <SeoTab e={e} set={set} />}
        {tab === 'publish' && (
          <div className="stack">
            <p>Choisissez les langues publiées. La publication est bloquée tant que les champs SEO obligatoires ne sont pas remplis dans chaque langue publiée.</p>
            <div className="row">{LANGS.map((l) => {
              const miss = seoErrors(e, l);
              return <label key={l} className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={(e.publishedLangs || []).includes(l)} onChange={(ev) => set('publishedLangs', ev.target.checked ? [...(e.publishedLangs || []), l] : e.publishedLangs.filter((x) => x !== l))} />{l.toUpperCase()} {miss.length ? <small style={{ color: '#9B1C1C' }}>({miss.length} manquant)</small> : <small style={{ color: '#136B3E' }}>prêt</small>}</label>;
            })}</div>
            <div className="row">
              {e.published
                ? <button className="btn btn--outline" onClick={() => save({ published: false })}>Dépublier</button>
                : <button className="btn btn--green btn--lg" onClick={() => save({ published: true })}>Publier en un clic</button>}
            </div>
            {canDelete && (
              <div className="panel danger-zone stack" style={{ marginTop: 16 }}>
                <strong>Supprimer l’excursion</strong>
                <p className="muted" style={{ margin: 0 }}>Suppression définitive dans toutes les langues. Pour la retirer temporairement du site, utilisez plutôt « Dépublier ».</p>
                <button type="button" className="btn btn--danger-outline" style={{ alignSelf: 'flex-start' }} onClick={async () => { if (await remove(e)) navTo('/admin/excursions'); }}>Supprimer cette excursion</button>
              </div>
            )}
          </div>
        )}
      </div>
      {dirty && <div className="save-bar"><span>Modifications non enregistrées</span><button className="btn btn--green" onClick={() => save()} disabled={busy}>{busy ? 'Traduction…' : 'Enregistrer'}</button></div>}
      {toast}
    </>
  );
}
