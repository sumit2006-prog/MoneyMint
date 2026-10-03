import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, BarChart3, Bell, ChevronDown, FileBarChart, FileUp, Home, Lightbulb, LogOut, Menu, Plus, Settings, Sparkles, Target, X } from 'lucide-react';
import { useAuth } from './services/auth';
import { FinanceProvider, useFinance } from './services/finance';
import { api } from './services/api';
import TransactionModal from './components/TransactionModal';
import Loading from './components/Loading';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Insights = lazy(() => import('./pages/Insights'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Budgets = lazy(() => import('./pages/Budgets'));
const Income = lazy(() => import('./pages/Income'));
const ImportStatement = lazy(() => import('./pages/ImportStatement'));
const Reports = lazy(() => import('./pages/Reports'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const AuthPage = lazy(() => import('./pages/Auth'));

const nav = [
  { label: 'Dashboard', path: '/', icon: Home, section: 'OVERVIEW' },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Insights', path: '/insights', icon: Lightbulb },
  { label: 'Transactions', path: '/transactions', icon: ArrowLeftRight, section: 'YOUR MONEY' },
  { label: 'Budgets', path: '/budgets', icon: Target },
  { label: 'Income', path: '/income', icon: ArrowDownLeft },
  { label: 'Import statement', path: '/import', icon: FileUp, section: 'TOOLS' },
  { label: 'Reports', path: '/reports', icon: FileBarChart },
  { label: 'Settings', path: '/settings', icon: Settings }
];
const titleMap = Object.fromEntries(nav.map((item) => [item.path, item.label]));

function GuestRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <main className="guest-loading"><Loading /></main>;
  return <Routes><Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} /><Route path="/signup" element={user ? <Navigate to="/" replace /> : <AuthPage mode="signup" />} /><Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} /></Routes>;
}

function Brand({ small = false }) {
  return <div className={`brand ${small ? 'brand-small' : ''}`}><img src="/assets/moneymint-logo.png" alt="MoneyMint logo" /><div><strong>Money<span>Mint</span></strong><small>TRACK · PLAN · SAVE · GROW</small></div></div>;
}

function AppLayout() {
  const { user, logout } = useAuth();
  const { dialog, openTransaction, closeTransaction, saveTransaction, toast, revision } = useFinance();
  const location = useLocation(); const navigate = useNavigate();
  const [categories, setCategories] = useState([]); const [moreOpen, setMoreOpen] = useState(false); const [accountOpen, setAccountOpen] = useState(false); const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => { api('/categories').then((r) => setCategories(r.categories)).catch(() => {}); }, [revision, location.pathname]);
  useEffect(() => { const theme = user?.theme || localStorage.getItem('moneymint_theme') || 'light'; const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme; document.documentElement.dataset.theme = resolved; if (user?.dateFormat) localStorage.setItem('moneymint_date_format', user.dateFormat); }, [user?.theme, user?.dateFormat]);
  useEffect(() => { setMoreOpen(false); setAccountOpen(false); setMobileNav(false); }, [location.pathname]);
  const currentTitle = titleMap[location.pathname] || 'Dashboard';
  const visibleNav = nav;
  const firstNav = [nav[0], nav[1], nav[3], nav[4], nav[8]];
  return <div className="app-frame">
    <aside className="sidebar">
      <Brand />
      <div className="workspace-chip"><span className="workspace-dot" /> PERSONAL SPACE <ChevronDown size={14} /></div>
      <nav className="side-nav">{visibleNav.map((item) => <div key={item.path}>{item.section && <span className="nav-section">{item.section}</span>}<NavLink to={item.path} end={item.path === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><item.icon size={18} strokeWidth={1.9} /><span>{item.label}</span>{item.path === '/budgets' && <span className="nav-dot" />}</NavLink></div>)}</nav>
      <div className="sidebar-bottom"><div className="upgrade-card"><span className="upgrade-icon"><Sparkles size={16} /></span><strong>A little more clarity</strong><p>Your next money win is one small habit away.</p><button onClick={() => navigate('/insights')}>Explore your insights <span>→</span></button></div><button className="sidebar-user" onClick={() => setAccountOpen((v) => !v)}><span className="avatar">{(user?.name || 'M').slice(0, 1).toUpperCase()}</span><span className="user-info"><b>{user?.name || 'Your account'}</b><small>Personal account</small></span><ChevronDown size={16} /></button>{accountOpen && <div className="account-menu"><button onClick={() => navigate('/settings')}><Settings size={16} /> Settings</button><button onClick={logout}><LogOut size={16} /> Sign out</button></div>}</div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><button className="icon-button menu-trigger" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={21} /></button><div className="breadcrumb">MoneyMint <span>/</span> <b>{currentTitle}</b></div><div className="top-actions"><button className="icon-button notification-button" onClick={() => navigate('/settings')} title="Notification preferences"><Bell size={18} /><i /></button><button className="top-user" onClick={() => setAccountOpen((v) => !v)}><span className="avatar">{(user?.name || 'M').slice(0, 1).toUpperCase()}</span><span>{user?.name?.split(' ')[0] || 'Account'}</span><ChevronDown size={15} /></button>{accountOpen && <div className="top-account-menu"><button onClick={() => navigate('/settings')}><Settings size={16} /> Settings</button><button onClick={logout}><LogOut size={16} /> Sign out</button></div>}</div></header>
      <div className="page-content"><Outlet /></div>
      <button className="floating-add" onClick={() => openTransaction()} aria-label="Add transaction"><Plus size={20} /><span>Add transaction</span></button>
      <nav className="mobile-bar">{firstNav.slice(0, 2).map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/'} className={({ isActive }) => isActive ? 'mobile-link active' : 'mobile-link'}><item.icon size={20} /><small>{item.label === 'Dashboard' ? 'Home' : item.label}</small></NavLink>)}<button className="mobile-add" onClick={() => openTransaction()}><Plus size={24} /><small>Add</small></button><NavLink to="/transactions" className={({ isActive }) => isActive ? 'mobile-link active' : 'mobile-link'}><ArrowLeftRight size={20} /><small>Activity</small></NavLink><button className={`mobile-link ${moreOpen ? 'active' : ''}`} onClick={() => setMoreOpen((v) => !v)}><Menu size={20} /><small>More</small></button></nav>
      {moreOpen && <div className="mobile-more-menu">{nav.filter((item) => !['/', '/analytics', '/transactions'].includes(item.path)).map((item) => <button key={item.path} onClick={() => { navigate(item.path); setMoreOpen(false); }}><item.icon size={17} />{item.label}</button>)}<button onClick={logout}><LogOut size={17} /> Sign out</button></div>}
      {mobileNav && <div className="mobile-drawer-scrim" onClick={() => setMobileNav(false)}><aside className="mobile-drawer" onClick={(e) => e.stopPropagation()}><div className="drawer-head"><Brand small /><button className="icon-button" onClick={() => setMobileNav(false)}><X size={20} /></button></div>{nav.map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><item.icon size={18} /><span>{item.label}</span></NavLink>)}<button className="nav-link" onClick={logout}><LogOut size={18} /><span>Sign out</span></button></aside></div>}
      {dialog && <TransactionModal key={dialog.transaction?._id || `new-${dialog.initialType}`} dialog={dialog} categories={categories} paymentMethods={user?.paymentMethods} defaultCategory={user?.defaultCategory} onClose={closeTransaction} onSave={saveTransaction} />}
      {toast && <div className={`toast toast-${toast.tone}`}><span>{toast.tone === 'success' ? '✓' : '!'}</span>{toast.message}</div>}
    </main>
  </div>;
}

function ProtectedApp() {
  const { user, loading } = useAuth();
  if (loading) return <main className="guest-loading"><Loading /></main>;
  if (!user) return <GuestRoutes />;
  return <FinanceProvider><Routes><Route element={<AppLayout />}><Route index element={<Dashboard />} /><Route path="analytics" element={<Analytics />} /><Route path="insights" element={<Insights />} /><Route path="transactions" element={<Transactions />} /><Route path="budgets" element={<Budgets />} /><Route path="income" element={<Income />} /><Route path="import" element={<ImportStatement />} /><Route path="reports" element={<Reports />} /><Route path="settings" element={<SettingsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes></FinanceProvider>;
}

export default function App() { return <Suspense fallback={<main className="guest-loading"><Loading /></main>}><ProtectedApp /></Suspense>; }
