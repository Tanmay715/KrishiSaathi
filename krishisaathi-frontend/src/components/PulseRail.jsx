import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import OverflowMenu from './OverflowMenu';
import ReminderList from './ReminderList';

function PulseRail({
  reminders = [],
  on_reminder_done,
  on_reminder_dismiss,
  on_add_reminder,
  on_generate_reminders,
  is_working = false,
}) {
  const { t } = useTranslation();
  const [show_all, setShowAll] = useState(false);
  const preview_limit = 4;
  const hidden = Math.max(0, reminders.length - preview_limit);

  return (
    <section className="pulse-rail surface-panel is-focus">
      <header className="pulse-rail-head">
        <div>
          <p className="surface-kicker">{t('reminders.title')}</p>
          <p className="surface-sub">{t('reminders.dashboard_hint')}</p>
        </div>
        <OverflowMenu
          label={t('common.more')}
          quiet
          items={[
            {
              id: 'generate',
              label: t('reminders.generate'),
              disabled: is_working,
              onClick: on_generate_reminders,
            },
            {
              id: 'add',
              label: t('reminders.add'),
              onClick: on_add_reminder,
            },
          ]}
        />
      </header>

      {reminders.length > 0 ? (
        <div className="pulse-reminders">
          <ReminderList
            reminders={reminders}
            limit={show_all ? null : preview_limit}
            on_done={on_reminder_done}
            on_dismiss={on_reminder_dismiss}
          />
          {hidden > 0 && !show_all && (
            <button type="button" className="text-link-btn" onClick={() => setShowAll(true)}>
              {t('reminders.view_all', { count: reminders.length })}
            </button>
          )}
          {show_all && reminders.length > preview_limit && (
            <button type="button" className="text-link-btn" onClick={() => setShowAll(false)}>
              {t('common.show_less')}
            </button>
          )}
        </div>
      ) : (
        <div className="pulse-reminders-empty">
          <p>{t('reminders.empty_calm')}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={is_working}
            onClick={on_generate_reminders}
          >
            {t('reminders.generate')}
          </button>
        </div>
      )}
    </section>
  );
}

export default PulseRail;
