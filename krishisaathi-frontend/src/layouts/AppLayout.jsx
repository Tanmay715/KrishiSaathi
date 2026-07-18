import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import OfflineBanner from '../components/OfflineBanner';
import PwaInstallPrompt from '../components/PwaInstallPrompt';
import QuickLogFab from '../components/QuickLogFab';
import ErrorBoundary from '../components/ErrorBoundary';

const NAV_ITEMS = [
  { to: '/', end: true, key: 'dashboard' },
  { to: '/farms', key: 'farms' },
  { to: '/assistant', key: 'assistant' },
  { to: '/activity', key: 'activity' },
  { to: '/profile', key: 'profile' },
];

function AppLayout() {
  const { t, i18n } = useTranslation();
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

  function toggleLanguage() {
    const next_lang = i18n.language === 'en' ? 'hi' : 'en';
    i18n.changeLanguage(next_lang);
    localStorage.setItem('ks_language', next_lang);
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

          <button type="button" className="btn btn-secondary btn-sm topbar-lang-btn" onClick={toggleLanguage}>
            {i18n.language === 'en' ? 'हिंदी' : 'English'}
          </button>
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
                {t(`nav.${item.key}`)}
              </NavLink>
            ))}
          </nav>

          <div className="app-drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={toggleLanguage}>
              {i18n.language === 'en' ? 'हिंदी' : 'English'}
            </button>
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
