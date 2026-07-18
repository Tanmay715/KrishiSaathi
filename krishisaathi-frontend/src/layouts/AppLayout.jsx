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
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.85,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (name === 'home') {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
      </svg>
    );
  }
  if (name === 'farms') {
    return (
      <svg {...common}>
        <path d="M12 3c2.5 3 4 6 4 9a4 4 0 1 1-8 0c0-3 1.5-6 4-9z" />
        <path d="M12 22v-6" />
      </svg>
    );
  }
  if (name === 'chat') {
    return (
      <svg {...common}>
        <path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      </svg>
    );
  }
  if (name === 'list') {
    return (
      <svg {...common}>
        <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
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
