/** Classify a reminder due date relative to local calendar day. */
export function getReminderBucket(due_at) {
  const due = new Date(due_at);
  if (Number.isNaN(due.getTime())) {
    return 'upcoming';
  }

  const now = new Date();
  const start_today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start_tomorrow = new Date(start_today);
  start_tomorrow.setDate(start_tomorrow.getDate() + 1);
  const due_day = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  if (due_day < start_today) {
    return 'overdue';
  }
  if (due_day < start_tomorrow) {
    return 'today';
  }
  return 'upcoming';
}

export function groupReminders(reminders = []) {
  const groups = {
    overdue: [],
    today: [],
    upcoming: [],
  };

  [...reminders]
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
    .forEach((reminder) => {
      groups[getReminderBucket(reminder.due_at)].push(reminder);
    });

  return groups;
}

export function formatReminderDue(due_at, language = 'en') {
  const due = new Date(due_at);
  if (Number.isNaN(due.getTime())) {
    return '—';
  }

  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  return due.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  });
}
