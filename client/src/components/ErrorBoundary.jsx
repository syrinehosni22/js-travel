import { Component } from 'react';
import i18n from 'i18next';

/** Erreur de chargement d'un fichier JS après une mise en ligne (ancienne version encore en cache) */
const isChunkError = (e) => /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(String(e?.message || e));

/**
 * Filet de sécurité : si une page plante, le visiteur voit un message simple
 * (dans sa langue) avec un bouton pour recharger, jamais l'erreur technique.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) {
    // Après une nouvelle mise en ligne, un ancien fichier peut manquer : on recharge une seule fois.
    if (isChunkError(error)) {
      try {
        if (!sessionStorage.getItem('tt_reloaded')) { sessionStorage.setItem('tt_reloaded', '1'); window.location.reload(); }
      } catch { /* stockage indisponible : on affiche simplement le message */ }
    }
    if (import.meta.env.DEV) console.error(error);
  }

  componentDidUpdate(prev) {
    // Changement de page : on retente l'affichage normal
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const t = (k, d) => i18n.t(k, { defaultValue: d });
    return (
      <div className="crash" role="alert">
        <h1>{t('common.crashTitle', 'Oups, cette page n’a pas pu s’afficher')}</h1>
        <p>{t('common.crashText', 'Rechargez la page. Si le problème continue, contactez-nous.')}</p>
        <div className="crash__actions">
          <button className="btn btn--primary" onClick={() => window.location.reload()}>{t('common.reload', 'Recharger la page')}</button>
          <a className="btn btn--outline" href="/">{t('common.back', 'Retour à l’accueil')}</a>
        </div>
      </div>
    );
  }
}
