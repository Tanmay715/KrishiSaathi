import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

function OfflineBanner() {
  const { t } = useTranslation();
  const is_online = useOnlineStatus();

  if (is_online) {
    return null;
  }

  return (
    <div className="offline-banner" role="status">
      {t('pwa.offline_message')}
    </div>
  );
}

export default OfflineBanner;
