import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import i18n, { LANGS, DEFAULT_LANG, PATHS } from './i18n.js';
import { AppProvider } from './context.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Excursions from './pages/Excursions.jsx';
import ExcursionDetail from './pages/ExcursionDetail.jsx';
import Transfers from './pages/Transfers.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import BookingView from './pages/BookingView.jsx';
import Contact from './pages/Contact.jsx';
import Faq from './pages/Faq.jsx';
import { Blog, BlogPost } from './pages/Blog.jsx';
import Legal from './pages/Legal.jsx';
import NotFound from './pages/NotFound.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

/** Langue à la première visite : choix mémorisé, sinon langue du navigateur (§6) */
function detectLang() {
  try { const saved = localStorage.getItem('lang'); if (LANGS.includes(saved)) return saved; } catch {}
  const nav = (navigator.languages || [navigator.language]).map((l) => l.slice(0, 2));
  return nav.find((l) => LANGS.includes(l)) || DEFAULT_LANG;
}

function LangRoot() {
  const { lang } = useParams();
  const ok = LANGS.includes(lang);
  useEffect(() => {
    if (!ok) return;
    i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
    try { localStorage.setItem('lang', lang); } catch {}
  }, [lang, ok]);
  if (!ok) return <Navigate to={`/${detectLang()}`} replace />;
  return (
    <AppProvider lang={lang}>
      <Layout><PageBoundary><PublicRoutes /></PageBoundary></Layout>
    </AppProvider>
  );
}

/** Si une page plante, l'en-tête et le pied de page restent affichés ; changer de page réessaie */
function PageBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

/** Routes publiques générées pour chaque langue avec ses segments traduits */
function PublicRoutes() {
  const { lang } = useParams();
  const p = PATHS[lang] || PATHS.en;
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path={p.excursions} element={<Excursions />} />
      <Route path={`${p.excursions}/:slug`} element={<ExcursionDetail />} />
      <Route path={p.transfers} element={<Transfers />} />
      <Route path={`${p.transfers}/:slug`} element={<Transfers />} />
      <Route path={p.cart} element={<Cart />} />
      <Route path={p.checkout} element={<Checkout />} />
      <Route path={`${p.booking}/:ref`} element={<BookingView />} />
      <Route path={p.contact} element={<Contact />} />
      <Route path={p.custom} element={<Contact custom />} />
      <Route path={p.faq} element={<Faq />} />
      <Route path={p.blog} element={<Blog />} />
      <Route path={`${p.blog}/:slug`} element={<BlogPost />} />
      <Route path={`${p.legal}/:key`} element={<Legal />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${detectLang()}`} replace />} />
      <Route path="/admin/*" element={<Suspense fallback={<div className="admin-loading">…</div>}><AdminApp /></Suspense>} />
      <Route path="/:lang/*" element={<LangRoot />} />
    </Routes>
  );
}
