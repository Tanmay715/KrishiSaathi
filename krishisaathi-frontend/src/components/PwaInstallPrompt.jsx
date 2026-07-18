import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

function isIosSafari() {
  if (typeof window === 'undefined') {
    return false;
  }

  const ua = window.navigator.userAgent;
  const is_ios = /iPad|iPhone|iPod/.test(ua);
  const is_standalone = window.matchMedia('(display-mode: standalone)').matches;
  return is_ios && !is_standalone;
}

function PwaInstallPrompt() {
  const { t } = useTranslation();
  const [install_prompt, setInstallPrompt] = useState(null);
  const [is_installed, setIsInstalled] = useState(false);
  const [show_ios_hint, setShowIosHint] = useState(false);

  useEffect(() => {
    function handleBeforeInstall(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function handleInstalled() {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowIosHint(false);
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    } else if (isIosSafari()) {
      setShowIosHint(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!install_prompt) {
      return;
    }

    await install_prompt.prompt();
    await install_prompt.userChoice;
    setInstallPrompt(null);
  }

  if (is_installed) {
    return null;
  }

  if (install_prompt) {
    return (
      <div className="pwa-install-banner no-print">
        <div>
          <strong>{t('pwa.install_title')}</strong>
          <p>{t('pwa.install_body')}</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleInstall}>
          {t('pwa.install_action')}
        </button>
      </div>
    );
  }

  if (!show_ios_hint) {
    return null;
  }

  return (
    <div className="pwa-install-banner no-print">
      <div>
        <strong>{t('pwa.install_title')}</strong>
        <p>{t('pwa.install_ios_body')}</p>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowIosHint(false)}>
        {t('common.hide')}
      </button>
    </div>
  );
}

export default PwaInstallPrompt;
