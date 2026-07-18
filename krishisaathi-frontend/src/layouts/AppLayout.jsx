import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import OfflineBanner from '../components/OfflineBanner';
import PwaInstallPrompt from '../components/PwaInstallPrompt';
import QuickLogFab from '../components/QuickLogFab';
import ErrorBoundary from '../components/ErrorBoundary';
import LanguageSwitcher from '../components/LanguageSwitcher';

const NAV_ITEMS = [
  { to: '/', end: true, key: 'dashboard', icon: 'home', tone: 'home' },
  { to: '/farms', key: 'farms', icon: 'farms', tone: 'farms' },
  { to: '/assistant', key: 'assistant', icon: 'chat', tone: 'chat' },
  { to: '/activity', key: 'activity', icon: 'list', tone: 'list' },
  { to: '/profile', key: 'profile', icon: 'user', tone: 'user' },
];

function NavIcon({ name }) {
  const frame = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  };

  if (name === 'home') {
    return (
      <svg {...frame}>
        <path fill="#60a5fa" d="M4 11.2 12 4.2l8 7V20a1.2 1.2 0 0 1-1.2 1.2H14v-6.2h-4v6.2H5.2A1.2 1.2 0 0 1 4 20v-8.8z" />
        <path fill="#fbbf24" d="M10 15h4v6.2h-4z" />
        <circle cx="12" cy="10.2" r="1.3" fill="#fff7ed" />
      </svg>
    );
  }
  if (name === 'farms') {
    return (
      <svg {...frame}>
        <ellipse cx="12" cy="20.4" rx="7" ry="1.7" fill="#a16207" opacity="0.4" />
        <path
          fill="#22c55e"
          d="M12 19C8.2 17.6 6 14.8 6 11.2c3.4.5 5.2 2.8 6 5.6.8-2.8 2.6-5.1 6-5.6C18 14.8 15.8 17.6 12 19z"
        />
        <path
          fill="#86efac"
          d="M12 13.5c-1.8-3-3-5.2-3.4-6.8 2 .9 3 2.8 3.4 5 .4-2.2 1.4-4.1 3.4-5-.4 1.6-1.6 3.8-3.4 6.8z"
        />
        <path d="M12 20.2V11" stroke="#166534" strokeWidth="1.7" strokeLinecap="round" fill="none" />
        <circle cx="12" cy="8.2" r="2.2" fill="#facc15" />
        <circle cx="11.3" cy="7.5" r="0.55" fill="#fef9c3" />
      </svg>
    );
  }
  if (name === 'chat') {
    return (
      <svg {...frame}>
        <path fill="#fbbf24" d="M4.2 6.2h15.6A1.8 1.8 0 0 1 21.6 8v7.2a1.8 1.8 0 0 1-1.8 1.8H9.4L4.2 20.8V6.2z" />
        <circle cx="9" cy="11.4" r="1.15" fill="#fff7ed" />
        <circle cx="12.2" cy="11.4" r="1.15" fill="#fff7ed" />
        <circle cx="15.4" cy="11.4" r="1.15" fill="#fff7ed" />
      </svg>
    );
  }
  if (name === 'list') {
    return (
      <svg {...frame}>
        <rect x="3.8" y="4.2" width="16.4" height="15.6" rx="2.4" fill="#a78bfa" />
        <rect x="7.4" y="7.2" width="9.2" height="1.8" rx="0.9" fill="#ede9fe" />
        <rect x="7.4" y="11.1" width="9.2" height="1.8" rx="0.9" fill="#ede9fe" />
        <rect x="7.4" y="15" width="6.4" height="1.8" rx="0.9" fill="#ede9fe" />
        <circle cx="5.8" cy="8.1" r="0.85" fill="#fef08a" />
        <circle cx="5.8" cy="12" r="0.85" fill="#fef08a" />
        <circle cx="5.8" cy="15.9" r="0.85" fill="#fef08a" />
      </svg>
    );
  }
  return (
    <svg {...frame}>
      <circle cx="12" cy="8.2" r="4" fill="#fb923c" />
      <path fill="#fdba74" d="M5.2 19.6c1.4-3.4 3.8-5 6.8-5s5.4 1.6 6.8 5c-2.1 1-4.4 1.5-6.8 1.5s-4.7-.5-6.8-1.5z" />
      <circle cx="12" cy="8" r="1.5" fill="#fff7ed" opacity="0.55" />
    </svg>
  );
}

function AppLayout() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [is_menu_open, setIsMenuOpen] = useState(false);
  const show_fab = !location.pathname.startsWith('/assistant');

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!is_menu_open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [is_menu_open]);

  function handleLogout() {
    setIsMenuOpen(false);
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="app-topbar">
          <button
            type="button"
            className="menu-toggle"
            onClick={() => setIsMenuOpen(true)}
            aria-label={t('nav.menu')}
            aria-expanded={is_menu_open}
          >
            <span className="menu-toggle-bars" aria-hidden="true" />
          </button>

          <div className="app-topbar-brand">
            <h1>{t('app.name')}</h1>
            <p>{t('app.tagline')}</p>
          </div>

          <LanguageSwitcher variant="topbar" />
        </header>

        {is_menu_open && (
          <button
            type="button"
            className="drawer-backdrop"
            aria-label={t('common.close')}
            onClick={() => setIsMenuOpen(false)}
          />
        )}

        <aside className={`app-drawer${is_menu_open ? ' is-open' : ''}`} aria-hidden={!is_menu_open}>
          <div className="app-drawer-header">
            <div>
              <h2>{t('app.name')}</h2>
              <p>{t('app.tagline')}</p>
            </div>
            <button
              type="button"
              className="drawer-close"
              onClick={() => setIsMenuOpen(false)}
              aria-label={t('common.close')}
            >
              ×
            </button>
          </div>

          <nav className="app-drawer-nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `drawer-link${isActive ? ' active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className={`drawer-link-icon tone-${item.tone}`} aria-hidden="true">
                  <NavIcon name={item.icon} />
                </span>
                <span>{t(`nav.${item.key}`)}</span>
              </NavLink>
            ))}
          </nav>

          <div className="app-drawer-footer">
            <LanguageSwitcher variant="drawer" />
            <button type="button" className="btn btn-secondary" onClick={handleLogout}>
              {t('nav.logout')}
            </button>
          </div>
        </aside>

        <main className="main-content">
          <OfflineBanner />
          <PwaInstallPrompt />
          <ErrorBoundary fallback_message={t('common.error')}>
            <Outlet />
          </ErrorBoundary>
        </main>
        {show_fab && <QuickLogFab />}
      </div>
    </div>
  );
}

export default AppLayout;
