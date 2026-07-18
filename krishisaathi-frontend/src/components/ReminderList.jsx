import { useTranslation } from 'react-i18next';
import OverflowMenu from './OverflowMenu';
import { formatReminderDue, getReminderBucket, groupReminders } from '../utils/reminder_timing';
import { normalizeLanguage } from '../utils/language';

const BUCKET_ORDER = ['overdue', 'today', 'upcoming'];

function ReminderList({
  reminders = [],
  on_done,
  on_dismiss,
  limit = null,
  show_groups = true,
}) {
  const { t, i18n } = useTranslation();
  const groups = groupReminders(reminders);

  let rows = [];
  if (show_groups) {
    BUCKET_ORDER.forEach((bucket) => {
      if (!groups[bucket].length) {
        return;
      }
      rows.push({ type: 'heading', bucket, id: `h-${bucket}` });
      groups[bucket].forEach((reminder) => {
        rows.push({ type: 'item', reminder, bucket, id: reminder.id });
      });
    });
  } else {
    rows = reminders.map((reminder) => ({
      type: 'item',
      reminder,
      bucket: getReminderBucket(reminder.due_at),
      id: reminder.id,
    }));
  }

  if (limit != null) {
    const items_only = rows.filter((row) => row.type === 'item').slice(0, limit);
    const allowed = new Set(items_only.map((row) => row.id));
    rows = rows.filter((row) => (
      row.type === 'heading'
        ? items_only.some((item) => item.bucket === row.bucket)
        : allowed.has(row.id)
    ));
  }

  if (!rows.length) {
    return null;
  }

  return (
    <ul className="reminder-calm-list">
      {rows.map((row) => {
        if (row.type === 'heading') {
          return (
            <li key={row.id} className={`reminder-calm-heading is-${row.bucket}`}>
              {t(`reminders.bucket_${row.bucket}`)}
            </li>
          );
        }

        const { reminder, bucket } = row;
        return (
          <li key={reminder.id} className={`reminder-calm-item is-${bucket}`}>
            <span className="reminder-calm-mark" aria-hidden="true" />
            <div className="reminder-calm-body">
              <strong>{reminder.title}</strong>
              <span className="reminder-calm-meta">
                {t(`reminders.types.${reminder.type}`)}
                {' · '}
                {formatReminderDue(reminder.due_at, normalizeLanguage(i18n.resolvedLanguage || i18n.language))}
              </span>
            </div>
            <OverflowMenu
              label={t('common.more')}
              quiet
              items={[
                {
                  id: 'done',
                  label: t('reminders.mark_done'),
                  onClick: () => on_done?.(reminder.id),
                },
                {
                  id: 'dismiss',
                  label: t('reminders.dismiss'),
                  onClick: () => on_dismiss?.(reminder.id),
                },
              ]}
            />
          </li>
        );
      })}
    </ul>
  );
}

export default ReminderList;
