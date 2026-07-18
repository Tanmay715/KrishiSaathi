const QUEUE_KEY = 'ks_offline_expense_queue';

export function getOfflineExpenseQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueOfflineExpense({ farm_id, payload }) {
  const queue = getOfflineExpenseQueue();
  const item = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    farm_id,
    payload,
    created_at: new Date().toISOString(),
  };
  queue.push(item);
  saveQueue(queue);
  return item;
}

export function getOfflineExpenseCount() {
  return getOfflineExpenseQueue().length;
}

export async function flushOfflineExpenseQueue(createExpenseFn) {
  const queue = getOfflineExpenseQueue();

  if (!queue.length) {
    return { synced: 0, remaining: 0 };
  }

  const remaining = [];
  let synced = 0;

  for (const item of queue) {
    try {
      await createExpenseFn(item.farm_id, item.payload);
      synced += 1;
    } catch (error) {
      remaining.push(item);
    }
  }

  saveQueue(remaining);
  return { synced, remaining: remaining.length };
}
