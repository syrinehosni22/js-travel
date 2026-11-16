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
  '/api/excursions/e1/reviews': [{ id: 'r1', name: 'Amel', rating: 5, comment: 'Journée magique', reply: 'Merci Amel !', createdAt: '2026-10-01' }, { id: 'r2', name: 'Tom', rating: 4, comment: '', createdAt: '2026-09-01' }],
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
  it('fiche excursion : espace vidéo YouTube, chargé au clic', async () => {
    routes['/api/excursions/excursion-carthage-sidi-bou-said'] = { ...excursion, videos: ['https://youtu.be/dQw4w9WgXcQ'] };
    try {
      const { container } = renderAt('/fr/excursions/excursion-carthage-sidi-bou-said');
      expect(await screen.findByRole('heading', { name: 'Vidéo' })).toBeTruthy();
      expect(container.querySelector('iframe[src*="youtube"]')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /Voir la vidéo/ }));
      await waitFor(() => expect(container.querySelector('iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toBeTruthy());
    } finally { routes['/api/excursions/excursion-carthage-sidi-bou-said'] = excursion; }
  });
  it('fiche excursion : plusieurs vidéos envoyées', async () => {
    routes['/api/excursions/excursion-carthage-sidi-bou-said'] = { ...excursion, videos: ['/uploads/a.mp4', '/uploads/b.mov'] };
    try {
      const { container } = renderAt('/fr/excursions/excursion-carthage-sidi-bou-said');
      expect(await screen.findByRole('heading', { name: 'Vidéos' })).toBeTruthy();
      const vids = container.querySelectorAll('.gyg-videos video');
      expect(vids.length).toBe(2);
      expect(vids[0].getAttribute('src')).toMatch(/\/uploads\/a\.mp4#t=0\.1$/);
    } finally { routes['/api/excursions/excursion-carthage-sidi-bou-said'] = excursion; }
  });
  it('fiche excursion : avis publiés, note moyenne et formulaire à étoiles', async () => {
    routes['/api/excursions/excursion-carthage-sidi-bou-said'] = { ...excursion, rating: { value: 4.5, count: 2 } };
    try {
      renderAt('/fr/excursions/excursion-carthage-sidi-bou-said');
      expect(await screen.findByRole('heading', { name: 'Avis clients' })).toBeTruthy();
      expect(await screen.findByText('Journée magique')).toBeTruthy();
      expect(screen.getByText('Merci Amel !')).toBeTruthy();
      expect(screen.getByText('4,5')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Laisser un avis' }));
      fireEvent.change(screen.getByLabelText(/Prénom/), { target: { value: 'Sami' } });
      // Sans note : message d'erreur, rien n'est envoyé
      fireEvent.click(screen.getByRole('button', { name: 'Publier mon avis' }));
      expect(await screen.findByText(/Choisissez une note/)).toBeTruthy();
      fireEvent.click(screen.getByRole('radio', { name: '4 étoiles' }));
      fireEvent.click(screen.getByRole('button', { name: 'Publier mon avis' }));
      expect(await screen.findByText(/publié après vérification/)).toBeTruthy();
      const post = global.fetch.mock.calls.find(([u, o]) => String(u).includes('/reviews') && o?.method === 'POST');
      expect(JSON.parse(post[1].body)).toMatchObject({ name: 'Sami', rating: 4 });
    } finally { routes['/api/excursions/excursion-carthage-sidi-bou-said'] = excursion; }
  });
  it('fiche excursion : prix selon le nombre de personnes', async () => {
    routes['/api/excursions/excursion-carthage-sidi-bou-said'] = { ...excursion, pricing: { mode: 'per_count', byCount: [{ n: 1, price: 120 }, { n: 2, price: 70 }, { n: 4, price: 55 }], zones: [] } };
    try {
      renderAt('/fr/excursions/excursion-carthage-sidi-bou-said');
      // 2 adultes par défaut → 70 € / pers., et le palier suivant est annoncé
      expect(await screen.findByText(/À partir de 4 personnes : 55/)).toBeTruthy();
      const add = screen.getAllByRole('button', { name: /Ajouter — Adultes/ })[0];
      fireEvent.click(add); fireEvent.click(add);
      await waitFor(() => expect(screen.queryByText(/À partir de 4 personnes/)).toBeNull());
      expect(screen.getAllByText(/220/).length).toBeGreaterThan(0);
    } finally { routes['/api/excursions/excursion-carthage-sidi-bou-said'] = excursion; }
  });
  it('fiche excursion sans vidéo : pas d’espace vidéo', async () => {
    renderAt('/fr/excursions/excursion-carthage-sidi-bou-said');
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Vidéo' })).toBeNull();
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
