import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { computeExcursionPrice, groupTable, minimumWarnings, countTable, fromPrice } from '../lib/pricing.js';
import { seoScore, seoErrors, slugify } from '../lib/seo.js';
import { adminApi, adminUpload, assetUrl } from '../api.js';
import RouteMap, { roadPath, searchPlace } from '../components/RouteMap.jsx';
import { parseVideo } from '../components/About.jsx';
import { allVideos, isVideoFile } from '../lib/videos.js';
import { useLoad, Top, Err, useToast, eur, LANGS, getPath, setPath, useConfirm, RemoveButton, TRANSLATION_WARNING } from './shared.jsx';
import { useAdmin } from './AdminApp.jsx';

const CATS = { culture: 'Culture', desert: 'Désert', sea: 'Mer', adventure: 'Aventure', family: 'Famille' };
const CHECK_LABELS = {
  kwInTitle: 'Mot-clé dans le titre SEO', kwInSlug: 'Mot-clé dans l’URL', kwInH1: 'Mot-clé dans le H1', kwInFirstParagraph: 'Mot-clé dans le premier paragraphe',
  kwInAlt: 'Mot-clé dans un texte alternatif', titleLength: 'Titre SEO de 50 à 60 caractères', descriptionLength: 'Méta description de 140 à 160 caractères',
  h1DiffersFromTitle: 'H1 différent du titre SEO', textLength: 'Texte de 300 mots minimum', internalLinks: 'Liens internes présents',
};
const EMPTY_L = () => Object.fromEntries(LANGS.map((l) => [l, '']));
/** Extras proposés en un clic (prix à compléter) */
const EXTRA_PRESETS = { guide: { fr: 'Guide accompagnateur', per: 'booking' }, dejeuner: { fr: 'Déjeuner', per: 'person' } };
/** Code interne unique d'un extra, déduit de son nom */
const uniqueKey = (base, list, self) => { let k = base || 'extra'; let n = 2; while (list.some((o, j) => j !== self && o.key === k)) k = `${base}-${n++}`; return k; };

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
  // Ordre d'affichage sur le site : glisser-déposer ou flèches, enregistré aussitôt
  const [rows, setRows] = useState([]);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [orderErr, setOrderErr] = useState(null);
  useEffect(() => { if (data) setRows(data); }, [data]);
  async function move(from, to) {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = [...rows];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setRows(next); setOrderErr(null);
    try { await adminApi.put('/excursions/order', { ids: next.map((x) => x._id) }); say('Ordre enregistré'); }
    catch (x) { setOrderErr(x); setRows(rows); }
  }
  return (
    <>
      <Top title="Excursions"><button className="btn btn--green" onClick={create}>+ Créer une excursion</button></Top>
      <Err error={error || orderErr} />
      <p className="muted" style={{ margin: '0 0 8px' }}>L’ordre de cette liste est celui du site (accueil et catalogue, tri « Recommandées »). Faites glisser une ligne par la poignée ⠿ ou utilisez les flèches : l’ordre est enregistré aussitôt.</p>
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th style={{ width: 150 }}>Ordre</th><th>Excursion</th><th>Catégorie</th><th>Tarif</th><th>Publiée</th>{LANGS.map((l) => <th key={l}>{l.toUpperCase()}</th>)}<th></th></tr></thead>
          <tbody>{rows.map((e, i) => (
            <tr key={e._id} draggable onDragStart={(ev) => { setDrag(i); ev.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(ev) => { ev.preventDefault(); setOver(i); }} onDragLeave={() => setOver((o) => (o === i ? null : o))}
              onDrop={(ev) => { ev.preventDefault(); if (drag != null) move(drag, i); setDrag(null); setOver(null); }} onDragEnd={() => { setDrag(null); setOver(null); }}
              className={`order-row${drag === i ? ' is-dragging' : ''}${over === i && drag !== i ? ' is-over' : ''}`}>
              <td><div className="order-cell">
                <span className="order-handle" title="Glisser pour déplacer" aria-hidden="true">⠿</span>
                <b>{i + 1}</b>
                <button type="button" className="order-btn" title="Mettre en premier" aria-label={`Mettre en premier ${e.title?.fr || ''}`} disabled={i === 0} onClick={() => move(i, 0)}>⤒</button>
                <button type="button" className="order-btn" title="Monter" aria-label={`Monter ${e.title?.fr || ''}`} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
                <button type="button" className="order-btn" title="Descendre" aria-label={`Descendre ${e.title?.fr || ''}`} disabled={i === rows.length - 1} onClick={() => move(i, i + 1)}>↓</button>
              </div></td>
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
        {info?.provider === 'mymemory' && <> (service gratuit limité ; votre prestataire technique peut activer DeepL pour une meilleure qualité).</>}
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

/** Langues proposées pour le guide (codes ISO) — dans l'ordre d'affichage */
const GUIDE_LANGS = [['fr', 'Français'], ['en', 'Anglais'], ['de', 'Allemand'], ['it', 'Italien'], ['es', 'Espagnol'], ['ar', 'Arabe'], ['ru', 'Russe'], ['pl', 'Polonais'], ['nl', 'Néerlandais'], ['pt', 'Portugais'], ['cs', 'Tchèque'], ['zh', 'Chinois']];
const guideLangLabel = (code) => GUIDE_LANGS.find(([c]) => c === code)?.[1] || code.toUpperCase();

/** Choix d'une ou plusieurs langues du guide (cases à cocher) */
function GuideLanguages({ value, onChange }) {
  const extra = value.filter((c) => !GUIDE_LANGS.some(([k]) => k === c));   // codes saisis autrefois à la main
  const order = [...GUIDE_LANGS.map(([c]) => c), ...extra];
  const toggle = (code, on) => onChange(order.filter((c) => (c === code ? on : value.includes(c))));
  return (
    <fieldset className="panel stack" style={{ gap: 10 }}>
      <legend><strong>Langues du guide</strong></legend>
      <p className="muted" style={{ margin: 0 }}>Cochez une ou plusieurs langues. Si vous en cochez plusieurs, le client choisit sa langue au moment de réserver.</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {order.map((code) => {
          const on = value.includes(code);
          return (
            <label key={code} className="check" style={{ minHeight: 0, padding: '6px 12px', borderRadius: 999, border: `1px solid ${on ? 'var(--green, #1F7A5A)' : 'var(--line, #E7E1D3)'}`, background: on ? 'var(--green-soft, #E8F3EE)' : '#fff', cursor: 'pointer' }}>
              <input type="checkbox" checked={on} onChange={(ev) => toggle(code, ev.target.checked)} />{guideLangLabel(code)}
            </label>
          );
        })}
      </div>
      {value.length === 0 && <p className="alert alert--warn" style={{ margin: 0 }}>Aucune langue cochée : la langue du guide ne sera pas affichée sur la fiche.</p>}
    </fieldset>
  );
}

function InfoTab({ e, set }) {
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState(null);
  const videos = allVideos(e);
  // Toujours enregistrer la liste dans `videos` et vider l'ancien champ `video`
  const setVideos = (list) => { set('videos', list); if (e.video) set('video', ''); };
  async function upload(files) {
    if (!files?.length) return;
    const list = [...files];
    const imgs = list.filter((f) => !isVideoFile(f));
    const vids = list.filter(isVideoFile);
    setUploading(true); setUpErr(null);
    try {
      if (imgs.length) {
        const res = await adminUpload(imgs);
        set('images', [...(e.images || []), ...res.map((x) => ({ url: x.url, alt: { ...EMPTY_L(), fr: e.title?.fr || '' } }))]);
      }
    } catch (x) { setUpErr(x); }
    // Vidéos envoyées une par une (fichiers lourds) ; celles déjà envoyées sont gardées en cas d'erreur
    const urls = [];
    try {
      for (const [i, f] of vids.entries()) {
        const label = `Envoi de la vidéo ${i + 1} sur ${vids.length} (${(f.size / 1048576).toFixed(0)} Mo)`;
        setUploading({ label, pct: 0 });
        const [res] = await adminUpload([f], { onProgress: (pct) => setUploading({ label, pct }) });
        urls.push(res.url);
      }
    } catch (x) { setUpErr(x); }
    if (urls.length) setVideos([...videos, ...urls]);
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
        <label className="lbl">Horaires de départ<input className="inp" value={csv(e.startTimes)} onChange={(ev) => set('startTimes', parse(ev.target.value))} placeholder="08:00" /></label>
      </div>
      <GuideLanguages value={e.guideLanguages || []} onChange={(v) => set('guideLanguages', v)} />
      <div className="row">
        {['private', 'family', 'bestseller', 'new'].map((b) => (
          <label key={b} className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={(e.badges || []).includes(b)} onChange={(ev) => set('badges', ev.target.checked ? [...(e.badges || []), b] : e.badges.filter((x) => x !== b))} />{b}</label>
        ))}
      </div>
      <div className={`panel stack`} style={{ borderStyle: 'dashed', borderWidth: 2, borderColor: drag ? 'var(--green)' : 'var(--line)' }}
        onDragOver={(ev) => { ev.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(ev) => { ev.preventDefault(); setDrag(false); upload(ev.dataTransfer.files); }}>
        <strong>Photos et vidéos</strong>
        <p className="muted">Glissez-déposez vos photos et vidéos ici (photos JPG, PNG, WebP · vidéos MP4, WebM, MOV · 100 Mo max par fichier) ou <label className="link-btn" style={{ display: 'inline' }}>choisissez-les<input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" hidden onChange={(ev) => { upload(ev.target.files); ev.target.value = ''; }} /></label>. La première photo est l’image principale.</p>
        {uploading && (typeof uploading === 'object' ? (
          <div className="upload-progress" role="status" aria-live="polite">
            <div className="row" style={{ justifyContent: 'space-between' }}><span>{uploading.label}</span><b>{uploading.pct < 100 ? `${uploading.pct} %` : 'Traitement…'}</b></div>
            <div className="upload-progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploading.pct} aria-label={uploading.label}><span style={{ width: `${uploading.pct}%` }} /></div>
            <small className="muted">Gardez cette page ouverte jusqu’à la fin de l’envoi.</small>
          </div>
        ) : <p>Envoi…</p>)}
        <Err error={upErr} />
        <div className="grid-3">
          {(e.images || []).map((img, i) => (
            <div key={i} className="stack" style={{ gap: 6 }}>
              <div className="media" style={{ height: 120, borderRadius: 12 }}><img src={assetUrl(img.url)} alt="" /></div>
              <input className="inp" placeholder="Description de la photo (français)" aria-label="Description de la photo" value={img.alt?.fr || ''} onChange={(ev) => set(`images.${i}.alt.fr`, ev.target.value)} />
              <div className="row">
                {i > 0 && <button type="button" className="btn btn--outline btn-sm" onClick={() => { const a = [...e.images]; [a[0], a[i]] = [a[i], a[0]]; set('images', a); }}>Image principale</button>}
                <RemoveButton what="cette photo" className="btn btn--danger-outline btn-sm" label="Supprimer" onConfirm={() => set('images', e.images.filter((_, k) => k !== i))} />
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Vidéos{videos.length > 0 ? ` (${videos.length})` : ''}</strong>
          <label className="btn btn--outline btn-sm">Ajouter des vidéos<input type="file" multiple accept="video/mp4,video/webm,video/quicktime" hidden disabled={!!uploading} onChange={(ev) => { upload(ev.target.files); ev.target.value = ''; }} /></label>
        </div>
        {videos.length === 0 && <p className="muted">Aucune vidéo. Elles s’affichent sur la fiche dans l’ordre ci-dessous.</p>}
        <div className="grid-3">
          {videos.map((v, i) => {
            const pv = parseVideo(v);
            return (
              <div key={v} className="stack" style={{ gap: 6 }}>
                {pv?.kind === 'file'
                  ? <video src={`${pv.src}#t=0.1`} controls preload="metadata" playsInline style={{ width: '100%', height: 160, borderRadius: 12, background: '#000' }} aria-label={`Vidéo ${i + 1}`} />
                  : <p className="muted" style={{ wordBreak: 'break-all' }}>{v}</p>}
                <div className="row">
                  {i > 0 && <button type="button" className="btn btn--outline btn-sm" onClick={() => { const a = [...videos]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setVideos(a); }}>Monter</button>}
                  <RemoveButton what="cette vidéo" className="btn btn--danger-outline btn-sm" label="Supprimer" onConfirm={() => setVideos(videos.filter((_, k) => k !== i))} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Tarifs + simulateur (§3.6) */
/* ======================= Carte et trajet ======================= */
function MapTab({ e, set }) {
  const it = e.itinerary || {};
  const stops = it.stops || [];
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  // Toute modification des étapes efface le tracé routier (il ne correspondrait plus)
  const setStops = (next) => { set('itinerary.stops', next); if (it.path?.length) set('itinerary.path', []); };
  const add = (p) => setStops([...stops, { name: { fr: p.name || `Étape ${stops.length + 1}` }, note: { fr: '' }, lat: p.lat, lng: p.lng }]);
  const move = (i, d) => { const n = [...stops]; [n[i], n[i + d]] = [n[i + d], n[i]]; setStops(n); };

  async function search(ev) {
    ev.preventDefault(); if (!q.trim()) return;
    setBusy('search'); setMsg(null);
    try { const r = await searchPlace(q.trim()); setFound(r); if (!r.length) setMsg({ type: 'warn', text: 'Aucun lieu trouvé. Essayez un autre nom ou cliquez directement sur la carte.' }); }
    catch { setMsg({ type: 'warn', text: 'La recherche de lieux est indisponible pour le moment : cliquez directement sur la carte.' }); }
    setBusy('');
  }
  async function trace() {
    setBusy('route'); setMsg(null);
    try {
      const r = await roadPath(stops);
      set('itinerary.path', r.path);
      setMsg({ type: 'ok', text: `Tracé par la route : environ ${r.km} km, ${Math.floor(r.minutes / 60)} h ${String(r.minutes % 60).padStart(2, '0')} de route. Pensez à enregistrer.` });
    } catch { setMsg({ type: 'warn', text: 'Le calcul de l’itinéraire routier est indisponible pour le moment. Le trajet reste affiché en lignes droites.' }); }
    setBusy('');
  }

  return (
    <div className="stack map-tab">
      <p className="help">Placez les étapes de l’excursion dans l’ordre : <b>cliquez sur la carte</b> ou recherchez un lieu. Déplacez un repère pour l’ajuster. La 1<sup>re</sup> étape est le départ, la dernière l’arrivée. Les noms sont saisis en français et traduits automatiquement.</p>
      <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={it.enabled !== false} onChange={(ev) => set('itinerary.enabled', ev.target.checked)} />Afficher la carte du trajet sur la fiche (2 étapes minimum)</label>

      <form className="row" onSubmit={search}>
        <input className="inp" style={{ flex: '1 1 260px' }} placeholder="Rechercher un lieu (ex. Douz, Amphithéâtre d’El Jem)" value={q} onChange={(ev) => setQ(ev.target.value)} aria-label="Rechercher un lieu" />
        <button className="btn btn--outline" disabled={busy === 'search'}>{busy === 'search' ? 'Recherche…' : 'Rechercher'}</button>
      </form>
      {found?.length > 0 && (
        <ul className="place-list panel" style={{ margin: 0 }}>
          {found.map((p, i) => (
            <li key={i}><span title={p.full}>{p.name}</span><button type="button" className="btn btn--green btn-sm" onClick={() => { add(p); setFound(null); setQ(''); }}>Ajouter comme étape {stops.length + 1}</button></li>
          ))}
        </ul>
      )}

      <RouteMap editable stops={stops.map((x) => ({ ...x, name: x.name?.fr }))} path={it.path} height={420}
        onAdd={(p) => add(p)} onMove={(i, p) => setStops(stops.map((x, k) => (k === i ? { ...x, ...p } : x)))} />

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="muted">{stops.length} étape{stops.length > 1 ? 's' : ''} · {it.path?.length > 1 ? 'tracé par la route' : 'tracé en lignes droites'}</span>
        <div className="row">
          {it.path?.length > 1 && <button type="button" className="btn btn--outline btn-sm" onClick={() => set('itinerary.path', [])}>Revenir aux lignes droites</button>}
          <button type="button" className="btn btn--green btn-sm" disabled={stops.length < 2 || busy === 'route'} onClick={trace}>{busy === 'route' ? 'Calcul…' : 'Tracer l’itinéraire par la route'}</button>
        </div>
      </div>
      {msg && <p className={`alert alert--${msg.type === 'ok' ? 'ok' : 'warn'}`} role="status" style={{ margin: 0 }}>{msg.text}</p>}

      <ol className="stop-list">
        {stops.map((x, i) => (
          <li key={i} className="stop-row">
            <span className={`map-pin map-pin--${i === 0 ? 'start' : i === stops.length - 1 ? 'end' : 'stop'}`} aria-hidden="true">{i + 1}</span>
            <div className="stop-row__fields">
              <input className="inp" value={x.name?.fr || ''} placeholder="Nom de l’étape" onChange={(ev) => set(`itinerary.stops.${i}.name.fr`, ev.target.value)} aria-label={`Nom de l’étape ${i + 1}`} />
              <input className="inp" value={x.note?.fr || ''} placeholder="Précision facultative (ex. arrêt 1 h, déjeuner)" onChange={(ev) => set(`itinerary.stops.${i}.note.fr`, ev.target.value)} aria-label={`Précision de l’étape ${i + 1}`} />
            </div>
            <div className="stop-row__actions">
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">↑</button>
              <button type="button" className="icon-btn" disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">↓</button>
              <button type="button" className="icon-btn" onClick={() => setStops(stops.filter((_, k) => k !== i))} aria-label={`Supprimer l’étape ${i + 1}`}>×</button>
            </div>
          </li>
        ))}
      </ol>
      {stops.length === 0 && <p className="muted">Aucune étape. Cliquez sur la carte pour placer le point de départ.</p>}
    </div>
  );
}

/**
 * Mode « Prix selon le nombre de personnes » : un prix par personne pour chaque taille de groupe.
 * Le remplissage en lot applique le même prix à plusieurs nombres d'un coup (ex. de 3 à 5 personnes).
 */
function CountPricing({ rows, onChange }) {
  const [bulk, setBulk] = useState({ from: 1, to: 4, price: '', per: 'person' });
  const r2 = (v) => Math.round((+v + Number.EPSILON) * 100) / 100;
  // Le prix par personne est stocké ; quand on saisit un total, prix / pers. = total ÷ nombre de personnes
  const setRow = (i, price) => save(rows.map((x, k) => (k === i ? { ...x, price } : x)));
  const save = (list) => onChange([...list].sort((a, b) => a.n - b.n));
  const apply = () => {
    const from = Math.max(1, Math.min(+bulk.from, +bulk.to)), to = Math.min(100, Math.max(+bulk.from, +bulk.to));
    if (!from || !to || bulk.price === '') return;
    const map = new Map(rows.map((r) => [r.n, r.price]));
    for (let n = from; n <= to; n++) map.set(n, bulk.per === 'total' ? +bulk.price / n : +bulk.price);
    save([...map].map(([n, price]) => ({ n, price })));
  };
  const last = rows[rows.length - 1];
  const bulkOk = +bulk.from > 0 && +bulk.to > 0 && bulk.price !== '';
  return (
    <fieldset className="panel stack">
      <legend><strong>Prix selon le nombre de personnes</strong></legend>
      <p className="muted" style={{ margin: 0 }}>Pour chaque taille de groupe, saisissez soit le prix <b>par personne</b>, soit le <b>total du groupe</b> : l’autre se calcule tout seul. Le dernier nombre du tableau est la capacité maximale : au-delà, le client demande un devis.</p>
      <div className="row" style={{ alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <label className="lbl" style={{ width: 90 }}>De<input className="inp" type="number" min="1" value={bulk.from} onChange={(ev) => setBulk({ ...bulk, from: ev.target.value })} /></label>
        <label className="lbl" style={{ width: 90 }}>à<input className="inp" type="number" min="1" value={bulk.to} onChange={(ev) => setBulk({ ...bulk, to: ev.target.value })} /></label>
        <label className="lbl" style={{ width: 130 }}>personnes : prix (€)<input className="inp" type="number" min="0" value={bulk.price} onChange={(ev) => setBulk({ ...bulk, price: ev.target.value })} onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); apply(); } }} /></label>
        <label className="lbl" style={{ width: 190 }}>Ce prix est
          <select className="inp" value={bulk.per} onChange={(ev) => setBulk({ ...bulk, per: ev.target.value })}><option value="person">par personne</option><option value="total">le total du groupe</option></select>
        </label>
        <button type="button" className="btn btn--primary btn-sm" disabled={!bulkOk} onClick={apply}>Appliquer</button>
      </div>
      {rows.length === 0 ? <p className="alert alert--info">Aucun prix pour l’instant : utilisez « Appliquer » ci-dessus (par exemple de 1 à 8 personnes à 60 € par personne, ou de 1 à 4 personnes à 200 € au total), puis ajustez chaque ligne.</p> : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Personnes</th><th>Prix / pers. (€)</th><th>Total du groupe (€)</th><th /></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.n}>
                <td>{r.n}</td>
                <td><input type="number" min="0" step="0.01" aria-label={`Prix par personne pour ${r.n}`} value={r2(r.price)} onChange={(ev) => setRow(i, +ev.target.value)} /></td>
                <td><input type="number" min="0" step="0.01" aria-label={`Total du groupe pour ${r.n}`} value={r2(r.price * r.n)} onChange={(ev) => setRow(i, +ev.target.value / r.n)} /></td>
                <td><RemoveButton what={`le prix pour ${r.n} personne${r.n > 1 ? 's' : ''}`} onConfirm={() => save(rows.filter((_, k) => k !== i))} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="row">
        <button type="button" className="link-btn" onClick={() => save([...rows, { n: (last?.n || 0) + 1, price: last?.price ?? 0 }])}>+ Ajouter {last ? `${last.n + 1} personnes` : '1 personne'}</button>
      </div>
    </fieldset>
  );
}

/** Prix « à partir de » affiché sur la carte de l'excursion (catalogue, accueil, haut du calculateur) */
function CardPrice({ e, set }) {
  const cp = e.pricing?.cardPrice || {};
  const P = (k) => `pricing.cardPrice.${k}`;
  const auto = fromPrice({ ...e, pricing: { ...e.pricing, cardPrice: undefined } });
  const unit = (per) => (per === 'vehicle' ? '/ véhicule' : per === 'group' ? '/ groupe' : '/ pers.');
  const autoText = auto.quote || auto.amount == null ? 'Sur devis' : `${eur(auto.amount)} ${unit(auto.per)}${auto.from > 1 ? ` · dès ${auto.from} personnes` : ''}`;
  const active = cp.amount != null && cp.amount !== '' && +cp.amount > 0;
  const shown = fromPrice(e);
  return (
    <fieldset className="panel stack" style={{ gap: 10 }}>
      <legend><strong>Prix affiché sur la carte</strong></legend>
      <p className="muted" style={{ margin: 0 }}>C’est le prix « À partir de » visible sur la carte de l’excursion (accueil, catalogue) et en haut du calculateur. Laissez vide pour le calcul automatique ({autoText}). Le prix réellement payé reste celui des tarifs ci-dessous.</p>
      <div className="row" style={{ alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <label className="lbl" style={{ width: 150 }}>Prix (€)<input className="inp" type="number" min="0" step="0.01" placeholder={auto.amount != null ? String(auto.amount) : ''} value={cp.amount ?? ''} onChange={(ev) => set(P('amount'), ev.target.value === '' ? null : +ev.target.value)} /></label>
        <label className="lbl" style={{ width: 170 }}>Par<select className="inp" value={cp.per || 'person'} onChange={(ev) => set(P('per'), ev.target.value)}><option value="person">personne</option><option value="group">groupe</option><option value="vehicle">véhicule</option></select></label>
        <label className="lbl" style={{ width: 210 }}>À partir de … personnes (facultatif)<input className="inp" type="number" min="1" value={cp.from ?? ''} onChange={(ev) => set(P('from'), ev.target.value === '' ? null : +ev.target.value)} /></label>
        {active && <button type="button" className="btn btn--outline btn-sm" onClick={() => set('pricing.cardPrice', { amount: null, per: 'person', from: null })}>Revenir au calcul automatique</button>}
      </div>
      <div className="muted" style={{ fontSize: 14 }}>Aperçu de la carte : <b style={{ color: 'var(--ink, #101A31)' }}>{shown.quote || shown.amount == null ? 'Sur devis' : `${eur(shown.amount)} ${unit(shown.per)} TTC${shown.from > 1 ? ` · dès ${shown.from} personnes` : ''}`}</b>{active ? ' (prix choisi)' : ' (automatique)'}</div>
    </fieldset>
  );
}

const PER_OPTS = [['booking', 'par groupe (réservation)'], ['person', 'par personne'], ['vehicle', 'par véhicule']];

/** Option guide : case à cocher proposée au client sur le formulaire final */
function GuideOptionPanel({ e, set }) {
  const g = e.pricing?.guideOption || {};
  const P = (k) => `pricing.guideOption.${k}`;
  return (
    <fieldset className="panel stack" style={{ gap: 10 }}>
      <legend><strong>Option guide</strong></legend>
      <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={!!g.enabled} onChange={(ev) => set(P('enabled'), ev.target.checked)} />Proposer un guide en option sur le formulaire de réservation</label>
      {g.enabled && (
        <div className="row" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="lbl" style={{ width: 150 }}>Prix du guide (€)<input className="inp" type="number" min="0" step="0.01" value={g.price ?? ''} onChange={(ev) => set(P('price'), ev.target.value === '' ? null : +ev.target.value)} /></label>
          <label className="lbl" style={{ width: 230 }}>Compté<select className="inp" value={g.per || 'booking'} onChange={(ev) => set(P('per'), ev.target.value)}>{PER_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
      )}
      {g.enabled && !(+g.price > 0) && <p className="alert alert--warn" style={{ margin: 0 }}>Indiquez un prix : sans prix, l’option n’est pas proposée.</p>}
      <p className="muted" style={{ margin: 0 }}>Le client coche « Ajouter un guide » au moment de réserver ; le prix s’ajoute au total.</p>
    </fieldset>
  );
}

/** Transfert ajouté quand l'hôtel du client est dans une ville qui n'est pas une ville de départ */
function CityTransfersPanel({ e, set }) {
  const list = e.pricing?.cityTransfers || [];
  const save = (v) => set('pricing.cityTransfers', v);
  const departures = (e.departureCities || []).join(', ') || 'aucune (onglet Infos et photos)';
  return (
    <fieldset className="panel stack" style={{ gap: 10 }}>
      <legend><strong>Transfert depuis une autre ville</strong></legend>
      <p className="muted" style={{ margin: 0 }}>Sur le formulaire final, le client indique la ville de son hôtel. Depuis les villes de départ ({departures}) et les zones de prise en charge, rien n’est ajouté. Depuis une ville de cette liste, le prix du transfert s’ajoute. Pour une ville absente de la liste, le client est prévenu que le prix sera confirmé par votre équipe.</p>
      {list.length > 0 && (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Ville</th><th>Prix du transfert (€)</th><th>Compté</th><th /></tr></thead>
          <tbody>{list.map((c, i) => (
            <tr key={i}>
              <td><input aria-label="Ville" placeholder="Ex. : Nabeul" value={c.city || ''} onChange={(ev) => save(list.map((x, k) => (k === i ? { ...x, city: ev.target.value } : x)))} /></td>
              <td><input aria-label={`Prix du transfert depuis ${c.city || 'cette ville'}`} type="number" min="0" step="0.01" value={c.price ?? ''} onChange={(ev) => save(list.map((x, k) => (k === i ? { ...x, price: ev.target.value === '' ? null : +ev.target.value } : x)))} /></td>
              <td><select aria-label="Compté" value={c.per || 'booking'} onChange={(ev) => save(list.map((x, k) => (k === i ? { ...x, per: ev.target.value } : x)))}>{PER_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
              <td><RemoveButton what={`le transfert depuis ${c.city || 'cette ville'}`} onConfirm={() => save(list.filter((_, k) => k !== i))} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <div><button type="button" className="link-btn" onClick={() => save([...list, { city: '', price: null, per: 'booking' }])}>+ Ville</button></div>
    </fieldset>
  );
}

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
            <option value="per_count">Prix selon le nombre de personnes</option>
            <option value="minimum">Minimum garanti + prix réduit</option><option value="per_person">Par personne</option>
            <option value="per_vehicle">Par véhicule</option><option value="group_flat">Forfait groupe</option><option value="quote">Sur devis</option>
          </select>
        </label>
        <label className="lbl">Supplément week-end (%)<input className="inp" type="number" value={pr.weekendSupplement ?? 0} onChange={(ev) => set(P('weekendSupplement'), +ev.target.value)} /></label>
      </div>

      <CardPrice e={e} set={set} />

      {pr.mode === 'per_count' && <CountPricing rows={countTable(pr)} onChange={(rows) => set(P('byCount'), rows)} />}

      {pr.mode !== 'quote' && pr.mode !== 'per_count' && (
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
        <label className="lbl">Réduction enfant (0,5 = −50 %)<input className="inp" type="number" step="0.05" value={pr.childDiscount ?? 0} onChange={(ev) => set(P('childDiscount'), +ev.target.value)} /></label>
        <label className="lbl">Âges enfant (de, à)<input className="inp" value={(pr.childAges || [4, 11]).join(',')} onChange={(ev) => set(P('childAges'), ev.target.value.split(',').map(Number))} /></label>
        <label className="lbl">Réduction bébé (1 = gratuit)<input className="inp" type="number" step="0.05" value={pr.infantDiscount ?? 0} onChange={(ev) => set(P('infantDiscount'), +ev.target.value)} /></label>
      </div>

      <GuideOptionPanel e={e} set={set} />
      <CityTransfersPanel e={e} set={set} />

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
            <select className="inp" value={g.lang} onChange={(ev) => set(P(`guideLanguages.${i}.lang`), ev.target.value)}>{[...new Set([...(e.guideLanguages?.length ? e.guideLanguages : LANGS), g.lang])].filter(Boolean).map((l) => <option key={l} value={l}>{guideLangLabel(l)}</option>)}</select>
            <input className="inp" type="number" value={g.fee ?? 0} onChange={(ev) => set(P(`guideLanguages.${i}.fee`), +ev.target.value)} style={{ width: 120 }} />
            <RemoveButton what="ce supplément de langue" onConfirm={() => set(P('guideLanguages'), pr.guideLanguages.filter((_, k) => k !== i))} />
          </div>
        ))}
        <button type="button" className="link-btn" onClick={() => set(P('guideLanguages'), [...(pr.guideLanguages || []), { lang: (e.guideLanguages || []).find((l) => !(pr.guideLanguages || []).some((g) => g.lang === l)) || e.guideLanguages?.[0] || 'de', fee: 0 }])}>+ Langue</button>
      </fieldset>

      <fieldset className="panel stack"><legend><strong>Extras payants</strong></legend>
        <p className="help" style={{ margin: 0 }}>Services que le client peut ajouter en réservant (guide, déjeuner, photos, quad…). Le prix s’ajoute au total. Nom et description en français, traduits automatiquement.</p>
        <div className="extras-admin">
          {(pr.options || []).map((o, i) => (
            <div key={i} className="extra-card">
              <div className="extra-card__head">
                <input className="inp" placeholder="Nom de l’extra (ex. Déjeuner traditionnel)" value={o.label?.fr || ''} aria-label="Nom de l’extra"
                  onChange={(ev) => set(P(`options.${i}.label.fr`), ev.target.value)}
                  onBlur={(ev) => { if (!o.key && ev.target.value) set(P(`options.${i}.key`), uniqueKey(slugify(ev.target.value), pr.options, i)); }} />
                <RemoveButton what="cet extra" onConfirm={() => set(P('options'), pr.options.filter((_, k) => k !== i))} />
              </div>
              <input className="inp" placeholder="Description courte (facultatif)" value={o.description?.fr || ''} aria-label="Description de l’extra" onChange={(ev) => set(P(`options.${i}.description.fr`), ev.target.value)} />
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <span className="money-inp money-inp--wide" style={{ flex: '0 0 130px' }}><input type="number" min="0" step="0.5" placeholder="Prix" value={o.price ?? ''} aria-label="Prix TTC en euros" onChange={(ev) => set(P(`options.${i}.price`), ev.target.value === '' ? 0 : +ev.target.value)} /><i>€ TTC</i></span>
                <select className="inp" style={{ flex: 1, minWidth: 0 }} value={o.per || 'person'} aria-label="Prix compté" onChange={(ev) => set(P(`options.${i}.per`), ev.target.value)}><option value="person">par personne</option><option value="vehicle">par véhicule</option><option value="booking">par réservation</option></select>
              </div>
              {!o.price && <small style={{ color: '#9B1C1C' }}>Prix à 0 € : l’extra apparaîtra gratuit.</small>}
            </div>
          ))}
        </div>
        <div className="row">
          <button type="button" className="btn btn--outline btn-sm" onClick={() => set(P('options'), [...(pr.options || []), { key: '', label: EMPTY_L(), description: EMPTY_L(), price: 0, per: 'person' }])}>+ Ajouter un extra</button>
          {Object.entries(EXTRA_PRESETS).filter(([k]) => !(pr.options || []).some((o) => o.key === k)).map(([k, x]) => (
            <button key={k} type="button" className="btn btn--outline btn-sm" onClick={() => set(P('options'), [...(pr.options || []), { key: k, label: { ...EMPTY_L(), fr: x.fr }, description: EMPTY_L(), price: 0, per: x.per }])}>+ {x.fr}</button>
          ))}
        </div>
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
      if (r.translation?.error) setTrWarn(`Enregistré, mais ${TRANSLATION_WARNING}.`);
      say(langs.length ? `Enregistré · traduit en ${langs.map((l) => l.toUpperCase()).join(', ')}` : 'Enregistré');
    } catch (x) { setSaveErr(x); }
    setBusy(false);
  }
  if (error) return <Err error={error} />;
  if (!e) return <p>Chargement…</p>;
  const TABS = { content: 'Textes', info: 'Infos et photos', map: 'Carte et trajet', pricing: 'Tarifs', availability: 'Disponibilités', seo: 'SEO', publish: 'Publication' };
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
        {tab === 'map' && <MapTab e={e} set={set} />}
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
