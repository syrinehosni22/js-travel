import { useEffect, useState } from 'react';
import { adminApi, adminUpload, assetUrl } from '../api.js';
import { useAdmin } from './AdminApp.jsx';
import CityTransfersTable from './CityTransfersTable.jsx';
import { useLoad, Top, Err, useToast, setPath, getPath, LANGS, RemoveButton, TRANSLATION_WARNING } from './shared.jsx';
import { SOCIAL_NAMES } from '../social.js';

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
  // Lien direct vers une section (ex. /admin/settings#deplacements)
  const ready = !!s;
  useEffect(() => { if (ready && window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' }); }, [ready]);
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
        <SiteSeoPanel s={s} set={set} lang={lang} setLang={setLang} />

        <section id="deplacements" className="panel stack">
          <h2 style={{ fontSize: 18 }}>Déplacement depuis une autre ville (toutes les excursions)</h2>
          <p className="muted" style={{ margin: 0 }}>Quand la ville de l’hôtel du client n’est pas une ville de départ de l’excursion, ce prix s’ajoute au total, pour <b>toutes les excursions</b>. Une excursion peut avoir un prix différent pour une ville (fiche excursion → Tarifs → Déplacement depuis une autre ville). Ville sans prix : le client est prévenu que le prix sera confirmé par votre équipe.</p>
          <CityTransfersTable list={s.cityTransfers || []} onChange={(v) => set('cityTransfers', v)} />
        </section>

        <MessagingPanel email={user?.email} s={s} set={set} />

        <WhatsAppAlertsPanel s={s} set={set} />

        <section className="panel stack">
          <h2 style={{ fontSize: 18 }}>Commission</h2>
          <p className="muted" style={{ margin: 0 }}>Calculée sur les réservations réglées ou terminées (Rapports → Commission, export Excel).</p>
          <div className="grid-2">{inp('commission.name', 'Bénéficiaire')}{inp('commission.percent', 'Taux de commission (%)', 'number')}</div>
        </section>

        <AboutPanel s={s} set={set} lang={lang} setLang={setLang} />

        <FollowPanel s={s} set={set} />

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
            {inp('fx.USD', '1 EUR = … USD', 'number')}
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
          <h2 style={{ fontSize: 18 }}>Coordonnées et avis</h2>
          <div className="grid-3">
            {inp('contact.phone', 'Téléphone')}{inp('contact.whatsapp', 'WhatsApp (format international)')}{inp('contact.viber', 'Viber')}
            {inp('contact.email', 'E-mail')}{inp('contact.address', 'Adresse')}{inp('contact.mapEmbed', 'Google Maps (URL d’intégration)')}
            {inp('social.tripadvisor', 'Tripadvisor (avis)')}{inp('social.googleReviews', 'Lien « Laisser un avis » Google')}
            {inp('reviews.rating', 'Note globale affichée', 'number')}{inp('reviews.count', 'Nombre d’avis', 'number')}
          </div>
        </section>

        <section className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 18 }}>FAQ et pages légales</h2>
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
/** Alerte WhatsApp envoyée à l'équipe à chaque nouvelle réservation */
/** E-mails et WhatsApp aux clients : état de la configuration du serveur + tests */
function MessagingPanel({ email, s, set }) {
  const { data: st } = useLoad(() => adminApi.get('/notifications/status'));
  const [to, setTo] = useState(email || '');
  const [phone, setPhone] = useState('');
  const [lang, setLang] = useState('fr');
  const [res, setRes] = useState({});
  async function run(key, call) {
    setRes((r) => ({ ...r, [key]: { busy: true } }));
    try { const out = await call(); setRes((r) => ({ ...r, [key]: out })); } catch (x) { setRes((r) => ({ ...r, [key]: { ok: false, error: x.message } })); }
  }
  const line = (ok, yes, no) => <li className={ok ? '' : 'muted'}>{ok ? '✓' : '✗'} {ok ? yes : no}</li>;
  const show = (r) => r && !r.busy && <p className={`alert ${r.ok ? 'alert--ok' : 'alert--warn'}`} style={{ margin: 0 }}>{r.ok ? 'Envoyé.' : `Échec — ${r.error || 'erreur inconnue'}`}</p>;
  return (
    <section className="panel stack">
      <h2 style={{ fontSize: 18 }}>E-mails et WhatsApp aux clients</h2>
      <fieldset className="stack" style={{ gap: 6, border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 6 }}>Être prévenu d’une nouvelle réservation par</legend>
        <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={s.notifications?.teamByWhatsapp !== false} onChange={(e) => set('notifications.teamByWhatsapp', e.target.checked)} />WhatsApp (numéros de la section « Alertes WhatsApp »)</label>
        <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={s.notifications?.teamByEmail !== false} onChange={(e) => set('notifications.teamByEmail', e.target.checked)} />E-mail (adresses ci-dessous)</label>
      </fieldset>
      <label className="lbl">E-mail(s) de l’équipe — reçoivent chaque nouvelle réservation, avis et message de contact (séparés par des virgules)
        <input className="inp" type="text" inputMode="email" placeholder="booking@jstraveltrip.com" value={s.notifications?.adminEmail || ''} onChange={(e) => set('notifications.adminEmail', e.target.value)} /></label>
      <p className="muted" style={{ margin: 0 }}>Le client reçoit aussi un e-mail de confirmation à l’adresse saisie dans sa réservation. Le serveur d’envoi se règle dans le fichier <code>server/.env</code> du serveur (voir <code>server/.env.example</code>), puis <code>pm2 restart js-travel-api --update-env</code>.</p>
      {st && (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
          {line(st.smtp, `E-mails : serveur ${st.smtpHost}, expéditeur ${st.mailFrom}`, 'E-mails : non configurés (SMTP_HOST, SMTP_USER, SMTP_PASS)')}
          {line(!!st.teamEmail, `Réservations envoyées à l’équipe : ${st.teamEmail}`, 'Aucune adresse d’équipe : remplissez le champ ci-dessus et enregistrez')}
          {line(st.whatsappCloud, 'WhatsApp : API WhatsApp Business configurée', 'WhatsApp : non configuré (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID)')}
          {line(!!st.clientTemplate, `Modèle des messages clients : ${st.clientTemplate}`, 'Modèle des messages clients : WHATSAPP_CLIENT_TEMPLATE vide (messages refusés par Meta hors des 24 h)')}
          {line(!!st.adminTemplate, `Modèle des alertes équipe : ${st.adminTemplate}`, 'Modèle des alertes équipe : WHATSAPP_TEMPLATE vide')}
        </ul>
      )}
      <div className="row" style={{ alignItems: 'end', flexWrap: 'wrap' }}>
        <label className="lbl" style={{ flex: '1 1 260px' }}>Envoyer un e-mail de test à<input className="inp" type="email" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button type="button" className="btn btn--outline btn-sm" disabled={res.mail?.busy || !to} onClick={() => run('mail', () => adminApi.post('/notifications/test-email', { to }))}>{res.mail?.busy ? 'Envoi…' : 'Tester l’e-mail'}</button>
      </div>
      {show(res.mail)}
      <div className="row" style={{ alignItems: 'end', flexWrap: 'wrap' }}>
        <label className="lbl" style={{ flex: '1 1 200px' }}>WhatsApp de test à un client<input className="inp" placeholder="+216 20 000 000" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="lbl" style={{ width: 110 }}>Langue<select className="inp" value={lang} onChange={(e) => setLang(e.target.value)}>{['fr', 'en', 'de', 'it', 'es'].map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</select></label>
        <button type="button" className="btn btn--outline btn-sm" disabled={res.wa?.busy || !phone} onClick={() => run('wa', () => adminApi.post('/notifications/test-client', { phone, lang }))}>{res.wa?.busy ? 'Envoi…' : 'Tester WhatsApp'}</button>
      </div>
      {show(res.wa)}
    </section>
  );
}

function WhatsAppAlertsPanel({ s, set }) {
  const n = s.notifications || {};
  const [test, setTest] = useState(null);
  async function run() {
    setTest({ busy: true });
    try { setTest(await adminApi.post('/notifications/test')); } catch (x) { setTest({ error: x }); }
  }
  return (
    <section className="panel stack">
      <h2 style={{ fontSize: 18 }}>Alertes WhatsApp (nouvelles réservations)</h2>
      <p className="muted" style={{ margin: 0 }}>À chaque nouvelle réservation, un message WhatsApp avec le détail (client, hôtel, excursions, total) est envoyé à ces numéros.</p>
      <div className="grid-2">
        <label className="lbl">Numéro(s) WhatsApp de l’admin — format international, séparés par des virgules
          <input className="inp" placeholder="+216 20 000 000" value={n.adminWhatsapp || ''} onChange={(e) => set('notifications.adminWhatsapp', e.target.value)} /></label>
        <label className="lbl">Clé CallMeBot (si vous n’avez pas l’API WhatsApp Business)
          <input className="inp" type="password" autoComplete="off" value={n.callmebotKey || ''} onChange={(e) => set('notifications.callmebotKey', e.target.value)} /></label>
      </div>
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Comment obtenir la clé CallMeBot (gratuit, 2 minutes)</summary>
        <ol className="muted" style={{ fontSize: 14 }}>
          <li>Ouvrez la <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noreferrer">page officielle CallMeBot</a> et enregistrez le numéro du robot indiqué (il change de temps en temps) dans les contacts du téléphone de l’admin.</li>
          <li>Envoyez-lui par WhatsApp le message : <b>I allow callmebot to send me messages</b></li>
          <li>Vous recevez une clé (apikey) : collez-la ci-dessus, enregistrez, puis cliquez sur « Envoyer un test ».</li>
          <li>La clé est liée au numéro qui l’a demandée : mettez un seul numéro d’admin avec CallMeBot. Pour plusieurs numéros, utilisez l’API WhatsApp Business (variables WHATSAPP_TOKEN et WHATSAPP_PHONE_ID du serveur).</li>
        </ol>
      </details>
      <div className="row">
        <button type="button" className="btn btn--outline btn-sm" disabled={test?.busy} onClick={run}>{test?.busy ? 'Envoi…' : 'Envoyer un test'}</button>
        <small className="muted">Enregistrez d’abord les paramètres.</small>
      </div>
      {test?.error && <Err error={test.error} />}
      {test?.results && (test.results.length === 0
        ? <p className="alert alert--warn" style={{ margin: 0 }}>Aucun numéro enregistré.</p>
        : test.results.map((r) => <p key={r.phone} className={`alert ${r.ok ? 'alert--ok' : 'alert--warn'}`} style={{ margin: 0 }}>+{r.phone} : {r.ok ? 'message envoyé' : `échec — ${r.error || 'erreur inconnue'}`}</p>))}
    </section>
  );
}

/** Mots-clés de tout le site (balise keywords de chaque page + données structurées de l'accueil) et SEO de l'accueil */
function SiteSeoPanel({ s, set, lang, setLang }) {
  const raw = getPath(s, `siteKeywords.${lang}`) || '';
  const list = raw.split(',').map((k) => k.trim()).filter(Boolean);
  const home = getPath(s, `seoHome.${lang}`) || {};
  return (
    <section className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18 }}>Référencement du site (SEO global)</h2>
        <div className="tabs">{LANGS.map((l) => <button type="button" key={l} aria-selected={l === lang} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</div>
      </div>
      <label className="lbl">Mots-clés du site ({lang.toUpperCase()}) — séparés par des virgules
        <textarea className="inp" rows={3} value={raw} onChange={(e) => set(`siteKeywords.${lang}`, e.target.value)}
          placeholder="excursion Tunisie, excursion Sousse, sortie désert Sahara, transfert aéroport Monastir, Sidi Bou Saïd" />
      </label>
      {list.length > 0 && <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{list.map((k) => <span key={k} className="chip" style={{ minHeight: 30, padding: '4px 12px', cursor: 'default' }}>{k}</span>)}</div>}
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Ajoutés à toutes les pages du site, en plus des mots-clés propres à chaque excursion. Saisissez-les en français : les autres langues vides sont traduites automatiquement à l’enregistrement.</p>
      <div className="grid-2">
        <label className="lbl">Mot-clé principal de l’accueil ({lang.toUpperCase()})<input className="inp" value={home.focusKeyword || ''} onChange={(e) => set(`seoHome.${lang}.focusKeyword`, e.target.value)} placeholder="excursions privées en Tunisie" /></label>
        <label className="lbl">Mots-clés secondaires de l’accueil<input className="inp" value={(home.secondaryKeywords || []).join(', ')} onChange={(e) => set(`seoHome.${lang}.secondaryKeywords`, e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} /></label>
        <label className="lbl">Titre SEO de l’accueil ({(home.metaTitle || '').length}/60)<input className="inp" value={home.metaTitle || ''} onChange={(e) => set(`seoHome.${lang}.metaTitle`, e.target.value)} /></label>
        <label className="lbl">Méta description de l’accueil ({(home.metaDescription || '').length}/160)<input className="inp" value={home.metaDescription || ''} onChange={(e) => set(`seoHome.${lang}.metaDescription`, e.target.value)} /></label>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Conseil : Google classe surtout grâce au <b>titre SEO</b>, à la <b>méta description</b> et au <b>texte des pages</b>. Reprenez vos mots-clés dans ces champs et dans les textes des excursions (onglet SEO de chaque excursion).</p>
    </section>
  );
}

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
      <label className="lbl">Titre ({lang.toUpperCase()})<input className="inp" placeholder="JS Travel Tunisia, votre agence de tourisme en Tunisie" value={a.title?.[lang] || ''} onChange={(e) => set(`about.title.${lang}`, e.target.value)} /></label>
      <label className="lbl">Texte de présentation ({lang.toUpperCase()})<textarea className="inp" rows={5} placeholder="Qui êtes-vous, depuis quand, ce qui vous distingue… Une ligne vide = nouveau paragraphe." value={a.text?.[lang] || ''} onChange={(e) => set(`about.text.${lang}`, e.target.value)} /></label>
      <div className="grid-2">
        <div className="stack" style={{ gap: 8 }}>
          <strong>Photo</strong>
          {a.image && <img src={assetUrl(a.image)} alt="" style={{ width: '100%', maxWidth: 320, aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12 }} />}
          <div className="row">
            <label className="btn btn--outline btn-sm">{busy === 'image' ? 'Envoi…' : a.image ? 'Changer la photo' : 'Choisir une photo'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => send(e.target.files, 'image')} /></label>
            {a.image && <button type="button" className="btn btn--danger-outline btn-sm" onClick={() => set('about.image', '')}>Retirer</button>}
          </div>
          <small className="muted">JPG, PNG ou WebP, 25 Mo max. Sans photo, une image de Tunisie est affichée.</small>
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

/** « Suivez-nous » du pied de page : réseaux, liens et ordre */
function FollowPanel({ s, set }) {
  const so = s.social || {};
  // Première ouverture : on reprend les anciens champs Facebook, Instagram, TikTok, Tripadvisor
  const legacy = ['facebook', 'instagram', 'tiktok', 'tripadvisor'].filter((k) => so[k]).map((k) => ({ network: k, name: '', url: so[k] }));
  const links = so.links?.length ? so.links : legacy;
  const setLinks = (next) => set('social.links', next);
  const bad = (u) => u && !/^https?:\/\//i.test(u);
  const move = (i, d) => { const n = [...links]; [n[i], n[i + d]] = [n[i + d], n[i]]; setLinks(n); };
  return (
    <section className="panel stack">
      <h2 style={{ fontSize: 18 }}>Suivez-nous (pied de page)</h2>
      <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={so.showFollow !== false} onChange={(e) => set('social.showFollow', e.target.checked)} />Afficher la rubrique « Suivez-nous » en bas du site</label>
      <p className="help" style={{ margin: 0 }}>Les liens s’affichent dans cet ordre. Collez l’adresse complète de la page (ex. https://www.facebook.com/jstravel). Un lien vide n’est pas affiché.</p>
      <div className="stack" style={{ gap: 8 }}>
        {links.map((x, i) => (
          <div key={i} className="follow-row">
            <select className="inp" value={x.network || 'other'} aria-label="Réseau" onChange={(e) => setLinks(links.map((y, k) => (k === i ? { ...y, network: e.target.value } : y)))}>
              {Object.entries(SOCIAL_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {(x.network === 'other' || !x.network) && <input className="inp" placeholder="Nom affiché" value={x.name || ''} aria-label="Nom affiché" onChange={(e) => setLinks(links.map((y, k) => (k === i ? { ...y, name: e.target.value } : y)))} />}
            <input className={`inp follow-row__url${bad(x.url) ? ' is-bad' : ''}`} placeholder="https://…" value={x.url || ''} aria-label="Adresse du lien" onChange={(e) => setLinks(links.map((y, k) => (k === i ? { ...y, url: e.target.value.trim() } : y)))}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && !/^https?:\/\//i.test(v) && /^[\w.-]+\.[a-z]{2,}/i.test(v)) setLinks(links.map((y, k) => (k === i ? { ...y, url: `https://${v}` } : y))); }} />
            <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">↑</button>
              <button type="button" className="icon-btn" disabled={i === links.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">↓</button>
              <RemoveButton what="ce lien" onConfirm={() => setLinks(links.filter((_, k) => k !== i))} />
            </span>
            {bad(x.url) && <small style={{ color: '#9B1C1C', gridColumn: '1 / -1' }}>L’adresse doit commencer par https://</small>}
          </div>
        ))}
        {links.length === 0 && <p className="muted" style={{ margin: 0 }}>Aucun réseau : la rubrique est masquée.</p>}
      </div>
      <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setLinks([...links, { network: Object.keys(SOCIAL_NAMES).find((k) => k !== 'other' && !links.some((l) => l.network === k)) || 'other', name: '', url: '' }])}>+ Ajouter un réseau</button>
    </section>
  );
}
