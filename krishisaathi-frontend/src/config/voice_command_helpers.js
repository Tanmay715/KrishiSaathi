import { createExpense, createIncome, createReminder } from '../services/farm_service';

export const VOICE_INTENTS = ['expense', 'income', 'reminder'];

export function findTarget(targets, target_key) {
  return targets.find((target) => target.target_key === target_key) || targets[0] || null;
}

export function targetLabel(target) {
  if (!target) {
    return '';
  }

  return [target.farm_name, target.plot_name, target.crop_name].filter(Boolean).join(' · ');
}

export async function saveVoiceRecord(intent, draft, target) {
  if (intent === 'reminder') {
    return createReminder(buildReminderPayload(draft, target));
  }

  if (!target?.farm_id) {
    throw new Error('no_target');
  }

  if (intent === 'income') {
    return createIncome(target.farm_id, buildIncomePayload(draft, target));
  }

  return createExpense(target.farm_id, buildExpensePayload(draft, target));
}

function buildExpensePayload(draft, target) {
  return {
    plot_id: target.plot_id || null,
    crop_cycle_id: target.crop_cycle_id || null,
    category: draft.category || 'other',
    title: draft.title,
    amount: Number(draft.amount),
    quantity: draft.quantity ?? null,
    unit: draft.unit || null,
    expense_date: draft.date || today(),
    notes: buildNotes(draft),
  };
}

function buildIncomePayload(draft, target) {
  return {
    plot_id: target.plot_id || null,
    crop_cycle_id: target.crop_cycle_id || null,
    category: draft.category || 'sale',
    title: draft.title,
    amount: Number(draft.amount),
    quantity: draft.quantity ?? null,
    unit: draft.unit || null,
    income_date: draft.date || today(),
    notes: buildNotes(draft),
  };
}

function buildReminderPayload(draft, target) {
  return {
    farm_id: target?.farm_id || null,
    plot_id: target?.plot_id || null,
    crop_cycle_id: target?.crop_cycle_id || null,
    type: draft.reminder_type || 'custom',
    title: draft.title,
    due_at: new Date(`${draft.due_at}T08:00:00`).toISOString(),
  };
}

function buildNotes(draft) {
  return draft.notes ? String(draft.notes).slice(0, 500) : null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
