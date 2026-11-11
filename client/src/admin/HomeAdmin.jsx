import { useEffect, useState } from 'react';
import { adminApi, adminUpload, assetUrl } from '../api.js';
import { PHOTOS, photoUrl } from '../images.js';
import i18n from '../i18n.js';
import { DEFAULT_SLIDES, DEFAULT_DESTINATIONS, BANNER_TARGETS } from '../homeDefaults.js';
import { useLoad, Top, Err, useToast, setPath, LANGS, useConfirm, TRANSLATION_WARNING } from './shared.jsx';

const CATS = { '': 'Recherche par mot', culture: 'Culture', desert: 'Désert', sea: 'Mer', adventure: 'Aventure', family: 'Famille' };
const fr = (k) => i18n.getFixedT('fr')(k);
const thumb = (img) => (PHOTOS[img] ? photoUrl(img, 640) : assetUrl(img));
const L = (fr) => ({ fr });

/** Choix d'une photo : photothèque du site ou envoi depuis l'ordinateur */
function PhotoPicker({ value, onChange, label = 'Photo' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function send(files) {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    try { const [f] = await adminUpload([files[0]]); onChange(f.url); setOpen(false); } catch (x) { setErr(x); }
    setBusy(false);
  }
  return (
    <div className="photo-picker">
      <div className="photo-picker__img">{value ? <img src={thumb(value)} alt="" /> : <span className="muted">Aucune photo</span>}</div>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="btn btn--outline btn-sm" onClick={() => setOpen(!open)} aria-expanded={open}>Photothèque</button>
        <label className="btn btn--outline btn-sm">{busy ? 'Envoi…' : 'Envoyer'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => send(e.target.files)} aria-label={`${label} : envoyer une photo`} /></label>
      </div>
      <Err error={err} />
      {open && (
        <div className="photo-picker__lib" role="listbox" aria-label="Photothèque">
          {Object.keys(PHOTOS).map((k) => (
            <button type="button" key={k} role="option" aria-selected={value === k} className={value === k ? 'is-on' : ''} onClick={() => { onChange(k); setOpen(false); }}>
              <img src={photoUrl(k, 640)} alt={PHOTOS[k].alt?.fr || k} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Page d'accueil : grande bannière (diaporama), bandeau doré et « Les incontournables ».
 * Tout se saisit en français ; les autres langues sont traduites automatiquement à l'enregistrement.
 * Un champ vide garde le texte par défaut du site.
 */
export default function HomeAdmin() {
  const { data, error } = useLoad(() => adminApi.get('/home-content'));
  const [h, setH] = useState(null);
  const [lang, setLang] = useState('fr');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [toast, say] = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (!data) return;
    // Première ouverture : on part du contenu affiché actuellement sur le site
    setH({
      ...data,
      hero: { ...data.hero, slides: data.hero?.slides?.length ? data.hero.slides : [...DEFAULT_SLIDES] },
      banner: { enabled: true, target: 'transfers', ...data.banner },
      destinations: data.destinations?.length ? data.destinations
        : DEFAULT_DESTINATIONS.map((d) => ({ name: L(d.name), image: d.image, category: d.category || '', q: d.q || '' })),
    });
  }, [data]);
  useEffect(() => {
    const warn = (ev) => { if (dirty) { ev.preventDefault(); ev.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  if (error) return <Err error={error} />;
  if (!h) return <p>Chargement…</p>;

  const set = (p, v) => { setH((cur) => setPath(cur, p, v)); setDirty(true); };
  const slides = h.hero?.slides || [];
  const dests = h.destinations || [];
  const moveDest = (i, d) => { const n = [...dests]; [n[i], n[i + d]] = [n[i + d], n[i]]; set('destinations', n); };
  const ph = (key) => (lang === 'fr' ? fr(key) : '');   // texte par défaut en indication

  async function save() {
    setErr(null); setBusy(true);
    try {
      const { translation, ...saved } = await adminApi.put('/home-content', h);
      setH((cur) => ({ ...cur, ...saved })); setDirty(false);
      say(translation?.error ? `Enregistré (${TRANSLATION_WARNING})` : 'Page d’accueil enregistrée et traduite');
    } catch (x) { setErr(x); }
    setBusy(false);
  }

  const LangTabs = () => (
    <div className="tabs" style={{ margin: 0, border: 0 }}>{LANGS.map((l) => <button key={l} type="button" aria-selected={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</div>
  );

  return (
    <>
      <Top title="Page d’accueil">
        <a className="btn btn--outline btn-sm" href="/fr" target="_blank" rel="noreferrer">Voir le site</a>
        <button className="btn btn--green" onClick={save} disabled={!dirty || busy}>{busy ? 'Enregistrement et traduction…' : 'Enregistrer'}</button>
      </Top>
      <p className="help">Écrivez en français : les autres langues sont traduites automatiquement à l’enregistrement (onglets EN, DE… pour corriger une traduction). Un champ vide garde le texte par défaut, affiché en gris.</p>
      <Err error={err} />

      <div className="stack">
        {/* ---------- Grande bannière ---------- */}
        <section className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}><h2 style={{ fontSize: 18 }}>Grande bannière (haut de page)</h2><LangTabs /></div>
          <label className="lbl">Titre ({lang.toUpperCase()})<input className="inp" placeholder={ph('hero.title')} value={h.hero?.title?.[lang] || ''} onChange={(e) => set(`hero.title.${lang}`, e.target.value)} /></label>
          <label className="lbl">Texte sous le titre ({lang.toUpperCase()})<textarea className="inp" rows={2} placeholder={ph('hero.text')} value={h.hero?.text?.[lang] || ''} onChange={(e) => set(`hero.text.${lang}`, e.target.value)} /></label>
          <strong>Photos du diaporama <small className="muted" style={{ fontWeight: 400 }}>(défilent toutes les 6 secondes · 5 maximum · format paysage conseillé)</small></strong>
          <div className="home-grid">
            {slides.map((img, i) => (
              <div key={i} className="home-card">
                <header><strong>Photo {i + 1}</strong>
                  <span className="row" style={{ gap: 4 }}>
                    <button type="button" className="icon-btn" disabled={i === 0} onClick={() => { const n = [...slides]; [n[i], n[i - 1]] = [n[i - 1], n[i]]; set('hero.slides', n); }} aria-label="Avancer">←</button>
                    <button type="button" className="icon-btn" disabled={i === slides.length - 1} onClick={() => { const n = [...slides]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; set('hero.slides', n); }} aria-label="Reculer">→</button>
                    <button type="button" className="icon-btn" disabled={slides.length <= 1} onClick={() => set('hero.slides', slides.filter((_, k) => k !== i))} aria-label={`Retirer la photo ${i + 1}`}>×</button>
                  </span>
                </header>
                <PhotoPicker label={`Photo ${i + 1}`} value={img} onChange={(v) => set(`hero.slides.${i}`, v)} />
              </div>
            ))}
            {slides.length < 5 && <button type="button" className="home-card home-card--add" onClick={() => set('hero.slides', [...slides, 'carthage'])}>+ Ajouter une photo</button>}
          </div>
        </section>

        {/* ---------- Bandeau doré ---------- */}
        <section className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}><h2 style={{ fontSize: 18 }}>Bandeau doré</h2><LangTabs /></div>
          <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={h.banner?.enabled !== false} onChange={(e) => set('banner.enabled', e.target.checked)} />Afficher le bandeau sur l’accueil</label>
          <div className="grid-2">
            <label className="lbl">Titre ({lang.toUpperCase()})<input className="inp" placeholder={ph('home.banner')} value={h.banner?.title?.[lang] || ''} onChange={(e) => set(`banner.title.${lang}`, e.target.value)} /></label>
            <label className="lbl">Petit texte ({lang.toUpperCase()})<input className="inp" placeholder={ph('home.bannerText')} value={h.banner?.text?.[lang] || ''} onChange={(e) => set(`banner.text.${lang}`, e.target.value)} /></label>
            <label className="lbl">Texte du bouton ({lang.toUpperCase()})<input className="inp" placeholder={ph('home.bookTransfer')} value={h.banner?.button?.[lang] || ''} onChange={(e) => set(`banner.button.${lang}`, e.target.value)} /></label>
            <label className="lbl">Le bouton mène vers<select className="inp" value={h.banner?.target || 'transfers'} onChange={(e) => set('banner.target', e.target.value)}>{Object.entries(BANNER_TARGETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <div className="promo promo--preview" aria-hidden="true">
            <div><strong>{h.banner?.title?.fr || fr('home.banner')}</strong><span>{h.banner?.text?.fr || fr('home.bannerText')}</span></div>
            <span className="btn btn-sm">{h.banner?.button?.fr || fr('home.bookTransfer')}</span>
          </div>
        </section>

        {/* ---------- Les incontournables ---------- */}
        <section className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}><h2 style={{ fontSize: 18 }}>Les incontournables (cartes destinations)</h2><LangTabs /></div>
          <label className="lbl">Titre de la rubrique ({lang.toUpperCase()})<input className="inp" placeholder={ph('home.destinationsTitle')} value={h.destinationsTitle?.[lang] || ''} onChange={(e) => set(`destinationsTitle.${lang}`, e.target.value)} /></label>
          <p className="help" style={{ margin: 0 }}>Chaque carte ouvre la liste des excursions, filtrée par <b>catégorie</b> ou par <b>mot</b> (ex. « Djerba » affiche les excursions dont le titre contient Djerba). 8 cartes maximum ; 5 donnent le meilleur rendu sur ordinateur.</p>
          <div className="home-grid">
            {dests.map((d, i) => (
              <div key={i} className="home-card">
                <header><strong>{d.name?.fr || `Carte ${i + 1}`}</strong>
                  <span className="row" style={{ gap: 4 }}>
                    <button type="button" className="icon-btn" disabled={i === 0} onClick={() => moveDest(i, -1)} aria-label="Avancer">←</button>
                    <button type="button" className="icon-btn" disabled={i === dests.length - 1} onClick={() => moveDest(i, 1)} aria-label="Reculer">→</button>
                    <button type="button" className="icon-btn" onClick={async () => { if (await confirm({ title: `Retirer « ${d.name?.fr || `carte ${i + 1}`} » ?`, message: 'La carte disparaîtra de l’accueil après « Enregistrer ».', confirmLabel: 'Retirer' })) set('destinations', dests.filter((_, k) => k !== i)); }} aria-label={`Retirer la carte ${i + 1}`}>×</button>
                  </span>
                </header>
                <PhotoPicker label={`Carte ${i + 1}`} value={d.image} onChange={(v) => set(`destinations.${i}.image`, v)} />
                <label className="lbl">Nom ({lang.toUpperCase()})<input className="inp" value={d.name?.[lang] || ''} placeholder={lang === 'fr' ? 'Ex. Djerba' : d.name?.fr} onChange={(e) => set(`destinations.${i}.name.${lang}`, e.target.value)} /></label>
                <div className="stack" style={{ gap: 10 }}>
                  <label className="lbl">Lien<select className="inp" value={d.category || ''} onChange={(e) => set(`destinations.${i}.category`, e.target.value)}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{k ? `Catégorie ${v}` : v}</option>)}</select></label>
                  {!d.category && <label className="lbl">Mot recherché<input className="inp" value={d.q || ''} placeholder="Ex. Djerba" onChange={(e) => set(`destinations.${i}.q`, e.target.value)} /></label>}
                </div>
              </div>
            ))}
            {dests.length < 8 && <button type="button" className="home-card home-card--add" onClick={() => set('destinations', [...dests, { name: L(''), image: '', category: '', q: '' }])}>+ Ajouter une destination</button>}
          </div>
        </section>
      </div>
      {dirty && <div className="save-bar"><span>Modifications non enregistrées</span><button className="btn btn--green" onClick={save} disabled={busy}>{busy ? 'Traduction…' : 'Enregistrer'}</button></div>}
      {toast}
    </>
  );
}
