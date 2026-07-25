import { createExpense, createFarm, createIncome, createPlot, createReminder } from '../services/farm_service';

export const VOICE_INTENTS = ['expense', 'income', 'reminder', 'create_farm', 'create_plot'];
export const STRUCTURE_INTENTS = ['create_farm', 'create_plot'];

export function findTarget(targets, target_key) {
  return targets.find((target) => target.target_key === target_key) || targets[0] || null;
}

export function targetLabel(target) {
  if (!target) {
    return '';
  }

  return [target.farm_name, target.plot_name, target.crop_name].filter(Boolean).join(' · ');
}

/** Suggestion chips that match where the farmer opened the mic. */
export function suggestionsForPage(page) {
  if (page === 'farms') {
    return ['create_farm', 'expense', 'assistant', 'reminder'];
  }
  if (page === 'farm') {
    return ['create_plot', 'expense', 'income', 'assistant'];
  }
  if (page === 'plot') {
    return ['expense', 'income', 'reminder', 'assistant'];
  }
  if (page === 'assistant') {
    return ['assistant', 'expense', 'income', 'reminder'];
  }
  if (page === 'money') {
    return ['expense', 'income', 'reminder', 'create_farm'];
  }
  return ['expense', 'income', 'reminder', 'assistant'];
}

export function deriveVoiceContext(pathname = '') {
  const farm_match = pathname.match(/^\/farms\/([^/]+)(?:\/plots\/([^/]+))?/);

  if (pathname.startsWith('/assistant')) {
    return { page: 'assistant' };
  }
  if (pathname.startsWith('/money')) {
    return { page: 'money' };
  }
  if (pathname.startsWith('/market')) {
    return { page: 'market' };
  }
  if (farm_match?.[2]) {
    return { page: 'plot', farm_id: farm_match[1], plot_id: farm_match[2] };
  }
  if (farm_match?.[1]) {
    return { page: 'farm', farm_id: farm_match[1] };
  }
  if (pathname.startsWith('/farms')) {
    return { page: 'farms' };
  }
  if (pathname.startsWith('/profile')) {
    return { page: 'profile' };
  }

  return { page: 'home' };
}

export async function saveVoiceRecord(intent, draft, target) {
  if (intent === 'create_farm') {
    return createFarm(buildFarmPayload(draft));
  }

  if (intent === 'create_plot') {
    const farm_id = draft.farm_id || target?.farm_id;
    if (!farm_id) {
      throw new Error('no_farm');
    }
    return createPlot(farm_id, buildPlotPayload(draft));
  }

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

function buildFarmPayload(draft) {
  return {
    name: draft.name || draft.title,
    state: draft.state || undefined,
    district: draft.district || undefined,
    village: draft.village || undefined,
    total_area: draft.total_area || draft.area || undefined,
    notes: draft.notes || undefined,
  };
}

function buildPlotPayload(draft) {
  return {
    name: draft.name || draft.title,
    area: Number(draft.area || draft.total_area),
    soil_type: draft.soil_type || undefined,
    notes: draft.notes || undefined,
  };
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
