import { NavLink, Outlet, useNavigate } from 'react-router-dom';
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

  function handleLogout() {
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
          <div className="app-topbar-brand">
            <h1>{t('app.name')}</h1>
            <p>{t('app.tagline')}</p>
          </div>
          <div className="app-topbar-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={toggleLanguage}>
              {i18n.language === 'en' ? 'हिंदी' : 'English'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
              {t('nav.logout')}
            </button>
          </div>
        </header>

        <nav className="app-tabs" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `app-tab${isActive ? ' active' : ''}`}
            >
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>

        <main className="main-content">
          <OfflineBanner />
          <PwaInstallPrompt />
          <ErrorBoundary fallback_message={t('common.error')}>
            <Outlet />
          </ErrorBoundary>
          <QuickLogFab />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
