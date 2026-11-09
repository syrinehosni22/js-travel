import { it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import '../src/i18n.js';
import App from '../src/App.jsx';
import { srcSet } from '../src/images.js';

it('l’accueil affiche les photos Unsplash avec srcset et texte alternatif', async () => {
  global.fetch = vi.fn(async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}) }));
  window.scrollTo = () => {}; window.matchMedia = () => ({ matches: false });
  const { container } = render(<HelmetProvider><MemoryRouter initialEntries={['/fr']}><App /></MemoryRouter></HelmetProvider>);
  // Capture dans waitFor : jsdom ne charge pas les images et déclenche onError, qui les retire ensuite
  let imgs = [];
  await waitFor(() => {
    imgs = [...container.querySelectorAll('main img')].map((i) => ({ alt: i.alt, src: i.getAttribute('src'), srcset: i.getAttribute('srcset') || '' }));
    expect(imgs.length).toBeGreaterThanOrEqual(10);
  });
  expect(imgs.every((i) => i.src.startsWith('https://images.unsplash.com/') && i.srcset.includes('640w'))).toBe(true);
  expect(imgs.some((i) => i.alt.includes('Houmt Souk'))).toBe(true);
});

it('une URL Unsplash stockée en base reçoit aussi un srcset', () => {
  expect(srcSet('https://images.unsplash.com/photo-1770712857881-2133f72fcab7?w=1600')).toContain('2400w');
});
