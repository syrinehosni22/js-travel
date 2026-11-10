import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, adminToken } from '../api.js';

/** Connexion avec double authentification (code à 6 chiffres d'une appli TOTP) */
export default function Login({ onLogin }) {
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '', code: '' });
  const [pre, setPre] = useState(null);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setError('');
    try {
      const r = pre ? await api.post('/admin/auth/2fa', { token: pre, code: f.code }) : await api.post('/admin/auth/login', { email: f.email, password: f.password });
      if (r.twoFactor) return setPre(r.token);
      adminToken.set(r.token); onLogin(r.user); nav('/admin');
    } catch (err) { setError(
      err.status === 401 ? 'E-mail, mot de passe ou code incorrect.'
        : err.status === 429 ? 'Trop de tentatives : patientez 15 minutes puis réessayez.'
          : err.status === 0 || err.status >= 500 ? 'Le serveur ne répond pas pour le moment. Réessayez dans quelques minutes.'
            : 'La connexion n’a pas abouti. Réessayez.'); }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-alt)', padding: 16 }}>
      <form className="panel stack" style={{ width: 'min(400px, 100%)' }} onSubmit={submit}>
        <img src="/brand/logo-full.png" alt="JS Travel Tunisia" width="180" style={{ alignSelf: 'center' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, textAlign: 'center' }}>Back-office</h1>
        {!pre ? <>
          <label className="lbl">E-mail<input className="inp" type="email" required autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="lbl">Mot de passe<input className="inp" type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        </> : (
          <label className="lbl">Code de vérification<input className="inp" inputMode="numeric" autoComplete="one-time-code" required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
        )}
        {error && <div className="alert alert--error" role="alert">{error}</div>}
        <button className="btn btn--green btn--lg">{pre ? 'Vérifier' : 'Se connecter'}</button>
      </form>
    </div>
  );
}
