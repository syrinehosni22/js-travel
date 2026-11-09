import { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { adminApi, adminToken } from '../api.js';
import { ConfirmProvider } from './shared.jsx';
import { Logo } from '../components/ui.jsx';
import './admin.css';
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';
import Bookings from './Bookings.jsx';
import Planning from './Planning.jsx';
import { ExcursionList, ExcursionEdit } from './Excursions.jsx';
import TransfersAdmin from './Transfers.jsx';
import { Promos, Partners, Users, Messages, Posts } from './Simple.jsx';
import Customers from './Customers.jsx';
import Reports from './Reports.jsx';
import SettingsAdmin from './Settings.jsx';
import SeoBoard from './SeoBoard.jsx';

const Ctx = createContext(null);
export const useAdmin = () => useContext(Ctx);

const MENU = [
  ['', 'Tableau de bord', ['manager']], ['bookings', 'Réservations', ['manager', 'partner']], ['planning', 'Planning', ['manager', 'driver']],
  ['excursions', 'Excursions', ['manager', 'editor']], ['transfers', 'Transferts', ['manager']], ['promos', 'Promotions', ['manager']],
  ['partners', 'Partenaires', ['manager']], ['customers', 'Clients', ['manager']], ['posts', 'Blog', ['editor', 'manager']],
  ['messages', 'Messages', ['manager']], ['seo', 'SEO', ['editor', 'manager']], ['reports', 'Rapports', ['manager', 'partner']],
  ['settings', 'Paramètres', ['admin']], ['users', 'Équipe', ['admin']],
];

function Shell({ user, children }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const can = (roles) => user.role === 'admin' || roles.includes(user.role);
  return (
    <div className="admin">
      <aside className={`admin-side${open ? ' open' : ''}`}>
        <div className="brand logo logo--light" style={{ textDecoration: 'none' }}><Logo light size={40} /></div>
        {MENU.filter(([, , r]) => can(r)).map(([p, label]) => <NavLink key={p} end={!p} to={`/admin/${p}`}>{label}</NavLink>)}
        <div style={{ marginTop: 'auto', padding: 12, fontSize: 13 }}>
          {user.name} · {user.role}<br />
          <button className="link-btn" style={{ color: '#fff' }} onClick={() => { adminToken.set(null); nav('/admin/login'); }}>Se déconnecter</button>
        </div>
      </aside>
      <div className="admin-main">
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="btn btn--outline btn-sm admin-menu-btn" onClick={() => setOpen(!open)} aria-expanded={open}>Menu</button>
          {can(['manager', 'editor']) && (
            <form style={{ flex: 1, maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); nav(`/admin/bookings?q=${encodeURIComponent(q)}`); }}>
              <input className="inp" style={{ width: '100%' }} type="search" placeholder="Rechercher : client, n° de réservation…" aria-label="Recherche globale" value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
          )}
        </div>
        {children}
      </div>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
    </div>
  );
}

export default function AdminApp() {
  const [user, setUser] = useState(undefined);
  const loc = useLocation();
  useEffect(() => {
    if (!adminToken.get()) return setUser(null);
    adminApi.get('/me').then(setUser).catch(() => setUser(null));
  }, [loc.pathname === '/admin/login']); // eslint-disable-line

  if (user === undefined) return <div className="admin-loading">Chargement…</div>;
  return (
    <ConfirmProvider>
    <Ctx.Provider value={{ user, setUser }}>
      <Helmet><title>Back-office · JS Travel Tunisia</title><meta name="robots" content="noindex" /><html lang="fr" /></Helmet>
      <Routes>
        <Route path="login" element={<Login onLogin={setUser} />} />
        <Route path="*" element={!user ? <Navigate to="/admin/login" replace /> : (
          <Shell user={user}>
            <Routes>
              <Route index element={user.role === 'driver' ? <Navigate to="planning" /> : user.role === 'editor' ? <Navigate to="excursions" /> : user.role === 'partner' ? <Navigate to="bookings" /> : <Dashboard />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="planning" element={<Planning />} />
              <Route path="excursions" element={<ExcursionList />} />
              <Route path="excursions/:id" element={<ExcursionEdit />} />
              <Route path="transfers" element={<TransfersAdmin />} />
              <Route path="promos" element={<Promos />} />
              <Route path="partners" element={<Partners />} />
              <Route path="customers" element={<Customers />} />
              <Route path="posts" element={<Posts />} />
              <Route path="messages" element={<Messages />} />
              <Route path="seo" element={<SeoBoard />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<SettingsAdmin />} />
              <Route path="users" element={<Users />} />
            </Routes>
          </Shell>
        )} />
      </Routes>
    </Ctx.Provider>
    </ConfirmProvider>
  );
}
