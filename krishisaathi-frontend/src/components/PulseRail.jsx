import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import OverflowMenu from './OverflowMenu';

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
  const preview = show_all ? reminders : reminders.slice(0, 3);
  const hidden = Math.max(0, reminders.length - 3);

  return (
    <section className="pulse-rail">
      <header className="pulse-rail-head">
        <div>
          <h2>{t('dashboard.today_actions')}</h2>
          <p>{t('dashboard.today_actions_hint')}</p>
        </div>
        <OverflowMenu
          label={t('reminders.title')}
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
          {preview.map((reminder) => {
            const is_overdue = new Date(reminder.due_at).getTime() < Date.now();
            return (
              <div
                key={reminder.id}
                className={`pulse-reminder${is_overdue ? ' is-overdue' : ''}`}
              >
                <div>
                  <strong>{reminder.title}</strong>
                  <span>
                    {t(`reminders.types.${reminder.type}`)}
                    {' · '}
                    {new Date(reminder.due_at).toLocaleDateString()}
                  </span>
                </div>
                <OverflowMenu
                  label={t('common.more')}
                  items={[
                    {
                      id: 'done',
                      label: t('reminders.mark_done'),
                      onClick: () => on_reminder_done?.(reminder.id),
                    },
                    {
                      id: 'dismiss',
                      label: t('reminders.dismiss'),
                      onClick: () => on_reminder_dismiss?.(reminder.id),
                    },
                  ]}
                />
              </div>
            );
          })}
          {hidden > 0 && !show_all && (
            <button type="button" className="text-link-btn" onClick={() => setShowAll(true)}>
              {t('reminders.view_all', { count: reminders.length })}
            </button>
          )}
          {show_all && reminders.length > 3 && (
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
