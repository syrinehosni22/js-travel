import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { LANGS, path } from '../i18n.js';
import { Seo, ErrorBox, Media } from '../components/ui.jsx';
import { waLink } from '../whatsapp.js';

/** Contact (§2) et demande « Sur mesure » / devis (§3.1 mode « sur devis ») */
export default function Contact({ custom }) {
  const { t } = useTranslation();
  const { lang, settings } = useApp();
  const c = settings?.contact || {};
  const [f, setF] = useState({ name: '', email: '', phone: '', subject: custom ? t('custom.title') : '', message: '', consent: false, website: '' });
  const [state, setState] = useState({ sent: false, error: null, sending: false });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  async function submit(e) {
    e.preventDefault();
    setState({ sending: true });
    try { await api.post('/contact', { ...f, lang }); setState({ sent: true }); }
    catch (error) { setState({ error }); }
  }
  const title = custom ? t('custom.title') : t('contact.title');
  return (
    <>
      <Seo title={title} alternates={Object.fromEntries(LANGS.map((l) => [l, path(l, custom ? 'custom' : 'contact')]))} />
      <div className="page-head page-head--photo"><Media photo={custom ? 'ksarGhilane' : 'houmtSouk'} alt="" sizes="100vw" eager /><div className="container"><h1>{title}</h1>{custom && <p>{t('custom.text')}</p>}</div></div>
      <div className="container cart">
        {state.sent ? <p className="alert alert--ok" role="status">{t('contact.sent')}</p> : (
          <form className="card form" onSubmit={submit}>
            <label className="field">{t('contact.name')} *<input required value={f.name} onChange={set('name')} autoComplete="name" /></label>
            <label className="field">{t('contact.email')} *<input required type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
            <label className="field">{t('contact.phone')}<input type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
            <label className="field">{t('contact.subject')} *<input required value={f.subject} onChange={set('subject')} /></label>
            <label className="field full">{t('contact.message')} *<textarea required minLength={5} value={f.message} onChange={set('message')} /></label>
            <input className="hp" tabIndex={-1} aria-hidden="true" autoComplete="off" value={f.website} onChange={set('website')} />
            <label className="check full"><input type="checkbox" required checked={f.consent} onChange={set('consent')} />{t('contact.consent')}</label>
            {state.error && <div className="full"><ErrorBox error={state.error} /></div>}
            <button className="btn btn--primary btn--lg full" disabled={state.sending}>{t('contact.send')}</button>
          </form>
        )}
        <aside className="card stack">
          <h2 style={{ fontSize: 20 }}>{t('contact.details')}</h2>
          {c.address && <p>{c.address}</p>}
          {c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}
          {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
          {waLink(c.whatsapp) && <a className="btn btn--whatsapp" href={waLink(c.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          {c.mapEmbed && <iframe title={t('common.map')} src={c.mapEmbed} style={{ width: '100%', height: 260, border: 0, borderRadius: 14 }} loading="lazy" />}
        </aside>
      </div>
    </>
  );
}