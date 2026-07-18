export const INCOME_CATEGORIES = ['harvest', 'sale', 'subsidy', 'other'];

const INCOME_CATEGORY_FIELDS = {
  harvest: {
    show_quantity: true,
    quantity_key: 'yield',
    default_unit: 'quintal',
    unit_options: ['quintal', 'kg', 'tonne'],
  },
  sale: {
    show_quantity: true,
    quantity_key: 'quantity',
    default_unit: 'quintal',
    unit_options: ['quintal', 'kg', 'tonne', 'bags'],
  },
  subsidy: {
    show_quantity: false,
  },
  other: {
    show_quantity: true,
    quantity_key: 'quantity',
    default_unit: '',
    unit_options: null,
  },
};

export function getIncomeCategoryConfig(category) {
  return INCOME_CATEGORY_FIELDS[category] || INCOME_CATEGORY_FIELDS.other;
}

export function getIncomeFormDefaults(category = 'harvest') {
  const config = getIncomeCategoryConfig(category);

  return {
    category,
    title: '',
    amount: '',
    quantity: '',
    unit: config.show_quantity ? config.default_unit || '' : '',
    income_date: new Date().toISOString().slice(0, 10),
    notes: '',
  };
}

export function applyIncomeCategoryChange(form, category) {
  const config = getIncomeCategoryConfig(category);

  return {
    ...form,
    category,
    quantity: config.show_quantity ? form.quantity : '',
    unit: config.show_quantity ? config.default_unit || '' : '',
  };
}

export function incomeToForm(income) {
  const category = income.category || 'other';
  const config = getIncomeCategoryConfig(category);
  const date_value = income.income_date ? String(income.income_date).slice(0, 10) : '';

  return {
    category,
    title: income.title || '',
    amount: income.amount != null ? String(income.amount) : '',
    quantity: income.quantity != null ? String(income.quantity) : '',
    unit: income.unit || (config.show_quantity ? config.default_unit || '' : ''),
    income_date: date_value || new Date().toISOString().slice(0, 10),
    notes: income.notes || '',
  };
}

export function buildIncomePayload(form, plot_id, crop_cycle_id) {
  const config = getIncomeCategoryConfig(form.category);
  const has_quantity = config.show_quantity && form.quantity;

  return {
    plot_id: plot_id || null,
    crop_cycle_id: crop_cycle_id || null,
    category: form.category,
    title: form.title,
    amount: Number(form.amount),
    quantity: has_quantity ? Number(form.quantity) : null,
    unit: has_quantity && form.unit ? form.unit : null,
    income_date: form.income_date,
    notes: form.notes || undefined,
  };
}
