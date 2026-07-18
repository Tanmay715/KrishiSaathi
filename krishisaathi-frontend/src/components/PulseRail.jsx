import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import OverflowMenu from './OverflowMenu';
import ReminderList from './ReminderList';

function PulseRail({
  actions = [],
  reminders = [],
  on_reminder_done,
  on_reminder_dismiss,
  on_add_reminder,
  on_generate_reminders,
  is_working = false,
}) {
  const { t } = useTranslation();
  const [show_all, setShowAll] = useState(false);
  const preview_limit = 3;
  const hidden = Math.max(0, reminders.length - preview_limit);

  return (
    <section className="pulse-rail surface-panel is-focus">
      <header className="pulse-rail-head">
        <div>
          <p className="surface-kicker">{t('dashboard.today_actions')}</p>
          <p className="surface-sub">{t('dashboard.today_actions_hint')}</p>
        </div>
        <OverflowMenu
          label={t('reminders.title')}
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

      {actions.length > 0 && (
        <div className="pulse-chips">
          {actions.slice(0, 4).map((item, index) => (
            <article
              key={item.id}
              className={`pulse-chip tone-${item.tone || 'calm'}${index === 0 ? ' is-lead' : ''}`}
            >
              <span className="pulse-chip-dot" />
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      )}

      {reminders.length > 0 && (
        <div className="pulse-reminders">
          <p className="pulse-reminders-label">{t('reminders.title')}</p>
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
      )}
    </section>
  );
}

export default PulseRail;
