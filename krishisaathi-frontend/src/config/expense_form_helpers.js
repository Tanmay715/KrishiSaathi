import { getExpenseCategoryConfig, getExpenseFormDefaults } from './expense_category_fields';

export function expenseToForm(expense) {
  const category = expense.category || 'other';
  const config = getExpenseCategoryConfig(category);
  const date_value = expense.expense_date ? String(expense.expense_date).slice(0, 10) : '';

  return {
    category,
    title: expense.title || '',
    amount: expense.amount != null ? String(expense.amount) : '',
    quantity: expense.quantity != null ? String(expense.quantity) : '',
    unit: expense.unit || (config.show_quantity ? config.default_unit || '' : ''),
    expense_date: date_value || new Date().toISOString().slice(0, 10),
    notes: expense.notes || '',
  };
}

export function buildExpensePayload(form, plot_id, crop_cycle_id) {
  const config = getExpenseCategoryConfig(form.category);
  const has_quantity = config.show_quantity && form.quantity;

  return {
    plot_id: plot_id || null,
    crop_cycle_id: crop_cycle_id || null,
    category: form.category,
    title: form.title,
    amount: Number(form.amount),
    quantity: has_quantity ? Number(form.quantity) : null,
    unit: has_quantity && form.unit ? form.unit : null,
    expense_date: form.expense_date,
    notes: form.notes || undefined,
  };
}

export { getExpenseFormDefaults };
