import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { createExpense } from '../services/farm_service';
import {
  flushOfflineExpenseQueue,
  getOfflineExpenseCount,
} from '../utils/offline_expense_queue';
import QuickExpenseModal from './QuickExpenseModal';

function QuickLogFab() {
  const { t } = useTranslation();
  const is_online = useOnlineStatus();
  const [is_open, setIsOpen] = useState(false);
  const [sync_notice, setSyncNotice] = useState('');
  const [pending_count, setPendingCount] = useState(getOfflineExpenseCount());

  useEffect(() => {
    async function syncQueue() {
      if (!is_online) {
        setPendingCount(getOfflineExpenseCount());
        return;
      }

      const result = await flushOfflineExpenseQueue(createExpense);
      setPendingCount(result.remaining);

      if (result.synced > 0) {
        setSyncNotice(t('quick_log.synced_offline', { count: result.synced }));
        window.setTimeout(() => setSyncNotice(''), 4000);
      }
    }

    syncQueue();
  }, [is_online, t]);

  return (
    <>
      {sync_notice && (
        <div className="info-banner quick-log-offline-notice no-print" role="status">
          {sync_notice}
        </div>
      )}
      {!is_online && pending_count > 0 && (
        <div className="offline-banner quick-log-offline-notice no-print" role="status">
          {t('quick_log.pending_offline', { count: pending_count })}
        </div>
      )}
      <button
        type="button"
        className="quick-log-fab no-print"
        onClick={() => setIsOpen(true)}
        aria-label={t('quick_log.title')}
      >
        + ₹
      </button>
      <QuickExpenseModal
        is_open={is_open}
        on_close={() => {
          setIsOpen(false);
          setPendingCount(getOfflineExpenseCount());
        }}
        on_saved={() => setPendingCount(getOfflineExpenseCount())}
      />
    </>
  );
}

export default QuickLogFab;
