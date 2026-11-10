import { useEffect, useState } from 'react';
import { adminApi, adminUpload, assetUrl } from '../api.js';
import { useAdmin } from './AdminApp.jsx';
import { useLoad, Top, Err, useToast, setPath, getPath, LANGS, RemoveButton, TRANSLATION_WARNING } from './shared.jsx';

/** Paramètres : saisons, devises, contact, réseaux, politique d'annulation, FAQ, pages légales, 2FA */
export default function SettingsAdmin() {
  const { user } = useAdmin();
  const { data, error } = useLoad(() => adminApi.get('/settings'));
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const [lang, setLang] = useState('fr');
  const [tfa, setTfa] = useState(null);
  const [code, setCode] = useState('');
  const [toast, say] = useToast();
  useEffect(() => { if (data) setS(data); }, [data]);
  if (error) return <Err error={error} />;
  if (!s) return <p>Chargement…</p>;
  const set = (p, v) => setS(setPath(s, p, v));
  const inp = (p, label, type = 'text') => <label className="lbl">{label}<input className="inp" type={type} value={getPath(s, p) ?? ''} onChange={(e) => set(p, type === 'number' ? +e.target.value : e.target.value)} /></label>;
  async function save() {
    setErr(null);
    try {
      const { translation, ...saved } = await adminApi.put('/settings', s);
      setS(saved);
      say(translation?.error ? `Enregistré (${TRANSLATION_WARNING})` : 'Paramètres enregistrés');
    } catch (x) { setErr(x); }
  }

  return (
    <>
      <Top title="Paramètres"><button className="btn btn--green" onClick={save}>Enregistrer</button></Top>
      <Err error={err} />
      <div className="stack">
        <AboutPanel s={s} set={set} lang={lang} setLang={setLang} />

        <section className="panel stack">
          <h2 style={{ fontSize: 18 }}>Saisons (MM-JJ)</h2>
          {(s.calendar?.seasons || []).map((x, i) => (
            <div key={i} className="row">
              <select className="inp" value={x.name} onChange={(e) => set(`calendar.seasons.${i}.name`, e.target.value)}><option value="low">Basse</option><option value="mid">Moyenne</option><option value="high">Haute</option></select>
              <input className="inp" value={x.from} onChange={(e) => set(`calendar.seasons.${i}.from`, e.target.value)} placeholder="07-01" style={{ width: 110 }} />
              <input className="inp" value={x.to} onChange={(e) => set(`calendar.seasons.${i}.to`, e.target.value)} placeholder="08-31" style={{ width: 110 }} />
              <RemoveButton what="cette période" onConfirm={() => set('calendar.seasons', s.calendar.seasons.filter((_, k) => k !== i))} />
            </div>
          ))}
          <button className="link-btn" onClick={() => set('calendar.seasons', [...(s.calendar?.seasons || []), { name: 'mid', from: '', to: '' }])}>+ Période</button>
          <label className="lbl">Jours fériés (haute saison), AAAA-MM-JJ séparés par des virgules<input className="inp" value={(s.calendar?.holidays || []).join(', ')} onChange={(e) => set('calendar.holidays', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} /></label>
          <label className="lbl">Dates fermées pour tout le site<input className="inp" value={(s.calendar?.blocked || []).join(', ')} onChange={(e) => set('calendar.blocked', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} /></label>
        </section>

        <section className="panel stack">
          <h2 style={{ fontSize: 18 }}>Devises et remises</h2>
          <div className="grid-4">
            <label className="lbl">Taux<select className="inp" value={s.fx?.mode || 'auto'} onChange={(e) => set('fx.mode', e.target.value)}><option value="auto">Mise à jour automatique quotidienne</option><option value="manual">Fixé manuellement</option></select></label>
            {inp('fx.GBP', '1 EUR = … GBP', 'number')}
            {inp('fx.TND', '1 EUR = … TND', 'number')}
            <p className="muted" style={{ alignSelf: 'flex-end' }}>Mis à jour : {s.fx?.updatedAt ? new Date(s.fx.updatedAt).toLocaleString('fr-FR') : '—'}</p>
            {inp('earlyBooking.daysBefore', 'Réservation anticipée : jours avant', 'number')}
            {inp('earlyBooking.percent', 'Réservation anticipée : remise %', 'number')}
            {inp('cancellationHours', 'Annulation gratuite jusqu’à (h)', 'number')}
            {inp('noShowBlockAfter', 'Bloquer un client après N absences', 'number')}
          </div>
        </section>

        <section className="panel stack">
          <h2 style={{ fontSize: 18 }}>Coordonnées, réseaux et avis</h2>
          <div className="grid-3">
            {inp('contact.phone', 'Téléphone')}{inp('contact.whatsapp', 'WhatsApp (format international)')}{inp('contact.viber', 'Viber')}
            {inp('contact.email', 'E-mail')}{inp('contact.address', 'Adresse')}{inp('contact.mapEmbed', 'Google Maps (URL d’intégration)')}
            {inp('social.tripadvisor', 'Tripadvisor')}{inp('social.googleReviews', 'Lien « Laisser un avis » Google')}{inp('social.facebook', 'Facebook')}
            {inp('social.instagram', 'Instagram')}{inp('social.tiktok', 'TikTok')}
            {inp('reviews.rating', 'Note globale affichée', 'number')}{inp('reviews.count', 'Nombre d’avis', 'number')}
          </div>
        </section>

        <section className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 18 }}>FAQ, pages légales et SEO de l’accueil</h2>
            <div className="tabs" style={{ margin: 0, border: 0 }}>{LANGS.map((l) => <button key={l} aria-selected={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</div>
          </div>
          {(s.faq || []).map((f, i) => (
            <div key={i} className="grid-2">
              <input className="inp" placeholder="Question" value={f.q?.[lang] || ''} onChange={(e) => set(`faq.${i}.q.${lang}`, e.target.value)} />
              <div className="row" style={{ flexWrap: 'nowrap' }}><textarea className="inp" style={{ flex: 1 }} placeholder="Réponse" value={f.a?.[lang] || ''} onChange={(e) => set(`faq.${i}.a.${lang}`, e.target.value)} />
                <RemoveButton what="cette question" onConfirm={() => set('faq', s.faq.filter((_, k) => k !== i))} /></div>
            </div>
          ))}
          <button className="link-btn" onClick={() => set('faq', [...(s.faq || []), { q: {}, a: {} }])}>+ Question</button>
          {[['legal.privacy', 'Politique de confidentialité'], ['legal.cancellation', 'Politique d’annulation'], ['legal.terms', 'Conditions générales']].map(([p, l]) => (
            <label key={p} className="lbl">{l} ({lang.toUpperCase()})<textarea className="inp" rows={5} value={getPath(s, `${p}.${lang}`) || ''} onChange={(e) => set(`${p}.${lang}`, e.target.value)} /></label>
          ))}
          <div className="grid-2">{inp(`seoHome.${lang}.metaTitle`, `Titre SEO de l’accueil (${lang.toUpperCase()})`)}{inp(`seoHome.${lang}.metaDescription`, `Méta description de l’accueil (${lang.toUpperCase()})`)}</div>
        </section>

        <section className="panel stack">
          <h2 style={{ fontSize: 18 }}>Double authentification ({user.email})</h2>
          {user.twoFactorEnabled ? <p className="alert alert--ok">Activée.</p> : !tfa ? (
            <button className="btn btn--outline" onClick={() => adminApi.post('/me/2fa/setup').then(setTfa)}>Activer la double authentification</button>
          ) : (
            <form className="stack" onSubmit={(e) => { e.preventDefault(); adminApi.post('/me/2fa/enable', { code }).then(() => say('2FA activée')).catch(setErr); }}>
              <p>Ajoutez ce compte dans Google Authenticator, Authy ou 1Password avec la clé : <code>{tfa.secret}</code></p>
              <label className="lbl">Code à 6 chiffres<input className="inp" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} /></label>
              <button className="btn btn--green">Confirmer</button>
            </form>
          )}
        </section>
      </div>
      {toast}
    </>
  );
}

/** Rubrique « Notre entreprise » de l'accueil : texte, photo, vidéo et chiffres clés */
function AboutPanel({ s, set, lang, setLang }) {
  const a = s.about || {};
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState(null);
  const stats = a.stats || [];
  async function send(files, field) {
    if (!files?.length) return;
    setErr(null); setBusy(field);
    try { const [f] = await adminUpload([files[0]]); set(`about.${field}`, f.url); } catch (x) { setErr(x); }
    setBusy('');
  }
  return (
    <section className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 18 }}>Présentation de l’entreprise (page d’accueil)</h2>
        <div className="tabs" style={{ margin: 0, border: 0 }}>{LANGS.map((l) => <button key={l} type="button" aria-selected={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</div>
      </div>
      <p className="help" style={{ margin: 0 }}>Écrivez en français : les autres langues sont traduites automatiquement à l’enregistrement. Laissez vide pour garder le texte par défaut.</p>
      <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={a.enabled !== false} onChange={(e) => set('about.enabled', e.target.checked)} />Afficher cette rubrique sur l’accueil</label>
      <Err error={err} />
      <label className="lbl">Titre ({lang.toUpperCase()})<input className="inp" placeholder="Une agence locale à votre service en Tunisie" value={a.title?.[lang] || ''} onChange={(e) => set(`about.title.${lang}`, e.target.value)} /></label>
      <label className="lbl">Texte de présentation ({lang.toUpperCase()})<textarea className="inp" rows={5} placeholder="Qui êtes-vous, depuis quand, ce qui vous distingue… Une ligne vide = nouveau paragraphe." value={a.text?.[lang] || ''} onChange={(e) => set(`about.text.${lang}`, e.target.value)} /></label>
      <div className="grid-2">
        <div className="stack" style={{ gap: 8 }}>
          <strong>Photo</strong>
          {a.image && <img src={assetUrl(a.image)} alt="" style={{ width: '100%', maxWidth: 320, aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12 }} />}
          <div className="row">
            <label className="btn btn--outline btn-sm">{busy === 'image' ? 'Envoi…' : a.image ? 'Changer la photo' : 'Choisir une photo'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => send(e.target.files, 'image')} /></label>
            {a.image && <button type="button" className="btn btn--danger-outline btn-sm" onClick={() => set('about.image', '')}>Retirer</button>}
          </div>
          <small className="muted">JPG, PNG ou WebP, 8 Mo max. Sans photo, une image de Tunisie est affichée.</small>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <strong>Vidéo de présentation (facultatif)</strong>
          <input className="inp" placeholder="Lien YouTube ou Vimeo" value={a.video || ''} onChange={(e) => set('about.video', e.target.value)} aria-label="Lien de la vidéo" />
          <div className="row">
            <label className="btn btn--outline btn-sm">{busy === 'video' ? 'Envoi…' : 'Ou envoyer un fichier MP4'}<input type="file" accept="video/mp4" hidden onChange={(e) => send(e.target.files, 'video')} /></label>
            {a.video && <button type="button" className="btn btn--danger-outline btn-sm" onClick={() => set('about.video', '')}>Retirer la vidéo</button>}
          </div>
          <small className="muted">Un bouton « lecture » s’affiche sur la photo. La vidéo ne se charge que si le visiteur clique.</small>
        </div>
      </div>
      <strong>Chiffres clés (4 maximum)</strong>
      {stats.map((x, i) => (
        <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="inp" style={{ width: 130 }} placeholder="Ex. 10 ans" value={x.value || ''} onChange={(e) => set(`about.stats.${i}.value`, e.target.value)} aria-label="Chiffre" />
          <input className="inp" style={{ flex: 1 }} placeholder={`Libellé (${lang.toUpperCase()}) — ex. d’expérience`} value={x.label?.[lang] || ''} onChange={(e) => set(`about.stats.${i}.label.${lang}`, e.target.value)} aria-label="Libellé" />
          <RemoveButton what="ce chiffre" onConfirm={() => set('about.stats', stats.filter((_, k) => k !== i))} />
        </div>
      ))}
      {stats.length < 4 && <button type="button" className="link-btn" onClick={() => set('about.stats', [...stats, { value: '', label: { fr: '' } }])}>+ Chiffre clé</button>}
    </section>
  );
}
