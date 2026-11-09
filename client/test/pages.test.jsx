/** Test de rendu des pages principales avec une API simulée (aucune base nécessaire). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import '../src/i18n.js';
import App from '../src/App.jsx';

const excursion = {
  id: 'e1', slug: 'excursion-carthage-sidi-bou-said', slugs: { fr: 'excursion-carthage-sidi-bou-said', en: 'carthage' }, title: 'Carthage & Sidi Bou Saïd',
  summary: 'Résumé', category: 'culture', durationLabel: 'Journée', guideLanguages: ['fr', 'en'], badges: ['bestseller'], departureCities: ['Sousse'],
  from: { amount: 60, per: 'person', from: 4 }, images: [], highlights: ['A'], included: ['B'], notIncluded: [], toBring: [], program: [{ time: '08:00', text: 'Départ' }], faq: [],
  availability: { mode: 'request', confirmWithinHours: 12 }, cancellationFreeHours: 24, seo: { metaTitle: 'Titre SEO' }, related: [],
  pricing: { mode: 'minimum', seasons: { high: { minimum: 240, adult: 60 }, mid: { minimum: 240, adult: 60 } }, childDiscount: 0.5, maxGroup: 8,
    zones: [{ key: 'sousse', label: 'Sousse', fee: 0 }, { key: 'hammamet', label: 'Hammamet', fee: 10 }], options: [{ key: 'lunch', label: 'Déjeuner', price: 15, per: 'person' }] },
};
const routes = {
  '/api/settings': { calendar: { seasons: [] }, contact: { whatsapp: '+216000' }, social: {}, fx: { EUR: 1, GBP: 0.85, TND: 3.4 }, faq: [{ q: 'Q ?', a: 'R.' }], seoHome: {} },
  '/api/excursions': [excursion],
  '/api/posts': [],
  '/api/excursions/excursion-carthage-sidi-bou-said': excursion,
  '/api/excursions/e1/availability': {},
  '/api/transfers/locations': [{ id: 'l1', name: 'Aéroport Monastir (MIR)', type: 'airport', zone: 'monastir-airport' }],
};
beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn(async (url) => {
    const path = String(url).split('?')[0];
    const body = routes[path];
    return { ok: body !== undefined, status: body !== undefined ? 200 : 404, headers: { get: () => 'application/json' }, json: async () => body ?? { error: 'NOT_FOUND' } };
  });
  window.scrollTo = () => {};
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
const renderAt = (url) => render(<HelmetProvider><MemoryRouter initialEntries={[url]}><App /></MemoryRouter></HelmetProvider>);

describe('site public', () => {
  it('accueil FR : bandeau, carte excursion avec prix « dès 4 »', async () => {
    renderAt('/fr');
    expect(await screen.findByText(/Des dunes du Sahara/)).toBeTruthy();
    expect(await screen.findByText('Carthage & Sidi Bou Saïd')).toBeTruthy();
    expect(screen.getAllByText(/dès 4 personnes/).length).toBeGreaterThan(0);
  });
  it('accueil EN traduit', async () => {
    renderAt('/en');
    expect(await screen.findByText(/From the Sahara dunes/)).toBeTruthy();
  });
  it('fiche excursion : calculateur sous le seuil puis au seuil', async () => {
    renderAt('/fr/excursions/excursion-carthage-sidi-bou-said');
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    // 2 adultes par défaut : minimum 240 € partagé → message « Plus que 2 personnes »
    expect(await screen.findByText(/Plus que 2 personnes/)).toBeTruthy();
    const add = screen.getAllByRole('button', { name: /Ajouter — Adultes/ })[0];
    fireEvent.click(add); fireEvent.click(add);
    await waitFor(() => expect(screen.getByText(/Tarif groupe appliqué/)).toBeTruthy());
    expect(screen.getAllByText(/240/).length).toBeGreaterThan(0);
  });
  it('catalogue, transferts, panier, contact, FAQ s’affichent', async () => {
    for (const [url, text] of [['/fr/excursions', /^1 excursion$/], ['/fr/transferts', /Transferts privés/], ['/fr/panier', /Votre panier est vide/], ['/fr/contact', /J’accepte que mes données/], ['/fr/faq', /Q \?/]]) {
      const { unmount } = renderAt(url);
      expect(await screen.findByText(text)).toBeTruthy();
      unmount();
    }
  });
  it('admin sans connexion → page de connexion', async () => {
    renderAt('/admin');
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeTruthy();
  });
});
