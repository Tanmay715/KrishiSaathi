import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { createExpense } from '../services/farm_service';
import {
  flushOfflineExpenseQueue,
  getOfflineExpenseCount,
} from '../utils/offline_expense_queue';
import QuickExpenseModal from './QuickExpenseModal';
import VoiceCommandSheet from './VoiceCommandSheet';

function QuickLogFab() {
  const { t } = useTranslation();
  const is_online = useOnlineStatus();
  const [is_open, setIsOpen] = useState(false);
  const [is_voice_open, setIsVoiceOpen] = useState(false);
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
      <div className="quick-log-fab-stack no-print">
        <button
          type="button"
          className="quick-log-fab is-voice"
          onClick={() => setIsVoiceOpen(true)}
          aria-label={t('voice_command.title')}
        >
          <MicGlyph />
        </button>
      </div>
      <QuickExpenseModal
        is_open={is_open}
        on_close={() => {
          setIsOpen(false);
          setPendingCount(getOfflineExpenseCount());
        }}
        on_saved={() => setPendingCount(getOfflineExpenseCount())}
      />
      <VoiceCommandSheet
        is_open={is_voice_open}
        on_close={() => setIsVoiceOpen(false)}
        on_saved={() => setPendingCount(getOfflineExpenseCount())}
        on_manual_entry={() => {
          setIsVoiceOpen(false);
          setIsOpen(true);
        }}
      />
    </>
  );
}

function MicGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default QuickLogFab;
