import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import OfflineBanner from '../components/OfflineBanner';
import PwaInstallPrompt from '../components/PwaInstallPrompt';
import QuickLogFab from '../components/QuickLogFab';
import ErrorBoundary from '../components/ErrorBoundary';
import LanguageSwitcher from '../components/LanguageSwitcher';

const TAB_ITEMS = [
  { to: '/', end: true, key: 'dashboard', icon: 'home' },
  { to: '/farms', key: 'farms', icon: 'farms' },
  { to: '/money', key: 'money', icon: 'list' },
  { to: '/market', key: 'market', icon: 'market' },
  { to: '/profile', key: 'profile', icon: 'user' },
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
        <path fill="currentColor" d="M4 11.2 12 4.2l8 7V20a1.2 1.2 0 0 1-1.2 1.2H14v-6.2h-4v6.2H5.2A1.2 1.2 0 0 1 4 20v-8.8z" />
      </svg>
    );
  }
  if (name === 'farms') {
    return (
      <svg {...frame}>
        <path
          fill="currentColor"
          d="M12 19C8.2 17.6 6 14.8 6 11.2c3.4.5 5.2 2.8 6 5.6.8-2.8 2.6-5.1 6-5.6C18 14.8 15.8 17.6 12 19z"
        />
        <path d="M12 20.2V11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (name === 'market') {
    return (
      <svg {...frame}>
        <path
          fill="currentColor"
          d="M4 8.5 6.2 4.8h11.6L20 8.5v1.2a2.3 2.3 0 0 1-4.6 0 2.3 2.3 0 0 1-4.6 0 2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 0 1-2.2-1.2V8.5z"
        />
        <path fill="currentColor" d="M6.2 11.8h11.6V19a1.2 1.2 0 0 1-1.2 1.2H7.4A1.2 1.2 0 0 1 6.2 19v-7.2z" />
      </svg>
    );
  }
  if (name === 'list') {
    return (
      <svg {...frame}>
        <rect x="3.8" y="4.2" width="16.4" height="15.6" rx="2.4" fill="currentColor" />
        <rect x="7.4" y="7.2" width="9.2" height="1.8" rx="0.9" fill="#fff" opacity="0.9" />
        <rect x="7.4" y="11.1" width="9.2" height="1.8" rx="0.9" fill="#fff" opacity="0.9" />
        <rect x="7.4" y="15" width="6.4" height="1.8" rx="0.9" fill="#fff" opacity="0.9" />
      </svg>
    );
  }
  return (
    <svg {...frame}>
      <circle cx="12" cy="8.2" r="4" fill="currentColor" />
      <path fill="currentColor" d="M5.2 19.6c1.4-3.4 3.8-5 6.8-5s5.4 1.6 6.8 5c-2.1 1-4.4 1.5-6.8 1.5s-4.7-.5-6.8-1.5z" />
    </svg>
  );
}

function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const is_assistant = location.pathname.startsWith('/assistant');
  const show_fab = !is_assistant && !location.pathname.startsWith('/market');

  if (localStorage.getItem('ks_needs_onboarding') === '1') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="app-shell">
      <div className={`app-frame no-drawer${is_assistant ? ' is-assistant-mode' : ' has-bottom-nav'}`}>
        {!is_assistant && (
          <header className="app-topbar is-centered">
            <div className="app-topbar-brand">
              <h1>{t('app.name')}</h1>
              <p>{t('app.tagline')}</p>
            </div>
            <LanguageSwitcher variant="topbar" />
          </header>
        )}

        <main className={`main-content${is_assistant ? ' is-assistant' : ''}`}>
          {!is_assistant && <OfflineBanner />}
          {!is_assistant && <PwaInstallPrompt />}
          <ErrorBoundary fallback_message={t('common.error')}>
            <Outlet />
          </ErrorBoundary>
        </main>

        {show_fab && <QuickLogFab />}

        {!is_assistant && (
          <nav className="app-bottom-nav" aria-label="Main">
            {TAB_ITEMS.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `bottom-nav-link${isActive ? ' is-active' : ''}`}
              >
                <span className="bottom-nav-icon" aria-hidden="true">
                  <NavIcon name={item.icon} />
                </span>
                <span className="bottom-nav-label">{t(`nav.${item.key}`)}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

export default AppLayout;
