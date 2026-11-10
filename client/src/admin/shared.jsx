import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { formatMoney } from '../lib/pricing.js';

export const eur = (v) => (v == null ? '—' : formatMoney(v, 'EUR', 'fr'));
export const STATUS = { new: 'Nouvelle', confirmed: 'Confirmée', paid_on_site: 'Réglée sur place', completed: 'Terminée', cancelled: 'Annulée', no_show: 'Absent' };
export const Status = ({ s }) => <span className={`st st-${s}`}>{STATUS[s] || s}</span>;
export const LANGS = ['en', 'fr', 'de', 'it', 'es'];

/** Chargement + rechargement */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    return fn().then((data) => setState({ data, loading: false, error: null })).catch((error) => setState({ data: null, loading: false, error }));
  }, deps); // eslint-disable-line
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) };
}

export function Top({ title, children }) {
  return <div className="admin-top"><h1>{title}</h1><div className="row">{children}</div></div>;
}

/** Messages d'erreur du back-office, rédigés pour l'équipe (aucun code ni détail technique) */
const ADMIN_ERRORS = {
  NETWORK: 'Impossible de joindre le serveur. Vérifiez votre connexion internet puis réessayez.',
  VALIDATION: 'Certaines informations sont manquantes ou invalides. Vérifiez le formulaire.',
  BAD_REQUEST: 'La demande n’a pas pu être traitée. Rechargez la page puis réessayez.',
  DUPLICATE: 'Cet élément existe déjà.',
  BAD_ID: 'Cet élément est introuvable (il a peut-être été supprimé).',
  NOT_FOUND: 'Cet élément est introuvable (il a peut-être été supprimé).',
  FORBIDDEN: 'Vous n’avez pas les droits nécessaires pour cette action.',
  TOO_LARGE: 'Fichier trop lourd (8 Mo maximum).',
  BAD_FILE: 'Ce fichier n’est pas accepté. Formats possibles : JPG, PNG, WebP, AVIF ou MP4.',
  TOO_MANY: 'Trop de tentatives. Patientez quelques minutes puis réessayez.',
  TRANSLATION_FAILED: 'La traduction automatique est indisponible pour le moment. Réessayez plus tard.',
  TRANSFERS_NOT_CONFIGURED: 'Les tarifs de transfert ne sont pas encore configurés.',
  SEO_INCOMPLETE: 'Des champs SEO obligatoires sont vides.',
  SERVER_ERROR: 'Une erreur est survenue sur le serveur. Réessayez dans un instant ; si cela continue, contactez votre prestataire technique.',
};

/** Transforme n'importe quelle erreur en phrase compréhensible */
export function friendlyError(error) {
  if (!error) return '';
  const code = error.body?.error;
  if (error.body?.message) return error.body.message;            // message déjà rédigé par le serveur
  if (code && ADMIN_ERRORS[code]) return ADMIN_ERRORS[code];
  const st = error.status;
  if (st === 0) return ADMIN_ERRORS.NETWORK;
  if (st === 403) return ADMIN_ERRORS.FORBIDDEN;
  if (st === 404) return ADMIN_ERRORS.NOT_FOUND;
  if (st === 413) return ADMIN_ERRORS.TOO_LARGE;
  if (st === 429) return ADMIN_ERRORS.TOO_MANY;
  if (st >= 500 || !st) return ADMIN_ERRORS.SERVER_ERROR;
  return 'L’opération n’a pas abouti. Vérifiez les informations puis réessayez.';
}

/** Message affiché quand la traduction automatique échoue après un enregistrement */
export const TRANSLATION_WARNING = 'la traduction automatique est indisponible pour le moment ; les autres langues seront complétées au prochain enregistrement';

export function Err({ error }) {
  if (!error) return null;
  if (import.meta.env.DEV) console.error(error);
  const fields = error.body?.error === 'VALIDATION' ? error.body?.details?.fields : null;
  return (
    <div className="alert alert--error" role="alert">
      {friendlyError(error)}
      {fields?.length > 0 && <div style={{ fontSize: 13, marginTop: 4 }}>Champs concernés : {fields.join(', ')}</div>}
    </div>
  );
}

/** Petit message de confirmation éphémère */
export function useToast() {
  const [msg, setMsg] = useState('');
  useEffect(() => { if (!msg) return; const h = setTimeout(() => setMsg(''), 2500); return () => clearTimeout(h); }, [msg]);
  const el = msg ? <div role="status" className="alert alert--ok" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 99 }}>{msg}</div> : null;
  return [el, setMsg];
}

/** Lit/écrit une valeur à un chemin « a.b.c » d'un objet (copie immuable) */
export const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
export function setPath(o, p, v) {
  const keys = p.split('.');
  const out = Array.isArray(o) ? [...o] : { ...o };
  let cur = out;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = v;
    else { cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...(cur[k] || {}) }; cur = cur[k]; }
  });
  return out;
}

/* ================= Fenêtre de confirmation (suppression, annulation…) ================= */
const ConfirmCtx = createContext(null);

/**
 * const confirm = useConfirm();
 * if (await confirm({ title: 'Supprimer ?', message: '…', confirmLabel: 'Supprimer' })) { … }
 */
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null);
  const cancelRef = useRef(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setReq({ danger: true, confirmLabel: 'Supprimer', ...opts, resolve })), []);
  const close = (v) => { req?.resolve(v); setReq(null); };
  useEffect(() => {
    if (!req) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [req]); // eslint-disable-line
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {req && (
        <div className="confirm-backdrop" onClick={() => close(false)}>
          <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg" onClick={(e) => e.stopPropagation()}>
            <div className={`confirm__icon${req.danger ? ' is-danger' : ''}`} aria-hidden="true">{req.danger ? '!' : '?'}</div>
            <h2 id="confirm-title">{req.title}</h2>
            {req.message && <p id="confirm-msg">{req.message}</p>}
            {req.danger && <p className="confirm__warn">Cette action est définitive.</p>}
            <div className="confirm__actions">
              <button ref={cancelRef} type="button" className="btn btn--outline" onClick={() => close(false)}>Annuler</button>
              <button type="button" className={`btn ${req.danger ? 'btn--danger' : 'btn--green'}`} onClick={() => close(true)}>{req.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

/** Bouton de suppression d'un élément d'une liste en cours d'édition (étape, question, photo…) */
export function RemoveButton({ what, onConfirm, label = '×', className = 'icon-btn' }) {
  const confirm = useConfirm();
  return (
    <button type="button" className={className} aria-label={`Supprimer ${what}`} title={`Supprimer ${what}`}
      onClick={async () => { if (await confirm({ title: `Supprimer ${what} ?`, message: 'L’élément sera retiré quand vous enregistrerez.', confirmLabel: 'Supprimer' })) onConfirm(); }}>{label}</button>
  );
}
