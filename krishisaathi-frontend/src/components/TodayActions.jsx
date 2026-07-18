import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import OverflowMenu from './OverflowMenu';

const TONE_CLASS = {
  urgent: 'is-urgent',
  weather: 'is-weather',
  money: 'is-money',
  reminder: 'is-reminder',
  calm: 'is-calm',
};

function TodayActions({
  actions = [],
  reminders = [],
  on_reminder_done,
  on_reminder_dismiss,
  on_add_reminder,
  on_generate_reminders,
  is_working = false,
}) {
  const { t } = useTranslation();
  const [show_all_reminders, setShowAllReminders] = useState(false);

  const preview_reminders = show_all_reminders ? reminders : reminders.slice(0, 3);
  const hidden_count = Math.max(0, reminders.length - 3);

  return (
    <section className="today-actions fade-in">
      <header className="today-actions-head">
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
        <ul className="today-action-list">
          {actions.slice(0, 4).map((item, index) => (
            <li
              key={item.id}
              className={`today-action-item ${TONE_CLASS[item.tone] || 'is-calm'}${index === 0 ? ' is-primary' : ''}`}
            >
              <span className="today-action-marker" aria-hidden="true" />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      )}

      {reminders.length > 0 && (
        <div className="today-reminder-block">
          <div className="today-reminder-label">{t('reminders.title')}</div>
          <ul className="today-reminder-list">
            {preview_reminders.map((reminder) => {
              const is_overdue = new Date(reminder.due_at).getTime() < Date.now();
              return (
                <li key={reminder.id} className={`today-reminder-row${is_overdue ? ' is-overdue' : ''}`}>
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
                </li>
              );
            })}
          </ul>
          {hidden_count > 0 && !show_all_reminders && (
            <button
              type="button"
              className="text-link-btn"
              onClick={() => setShowAllReminders(true)}
            >
              {t('reminders.view_all', { count: reminders.length })}
            </button>
          )}
          {show_all_reminders && reminders.length > 3 && (
            <button
              type="button"
              className="text-link-btn"
              onClick={() => setShowAllReminders(false)}
            >
              {t('common.show_less')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default TodayActions;
