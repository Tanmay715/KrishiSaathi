export const EXPENSE_CATEGORIES = [
  'seed',
  'fertilizer',
  'pesticide',
  'irrigation',
  'labor',
  'equipment',
  'transport',
  'other',
];

const EXPENSE_CATEGORY_FIELDS = {
  seed: {
    show_quantity: true,
    quantity_key: 'quantity',
    default_unit: 'kg',
    unit_options: ['kg', 'bags', 'quintal'],
  },
  fertilizer: {
    show_quantity: true,
    quantity_key: 'quantity',
    default_unit: 'kg',
    unit_options: ['kg', 'bags'],
  },
  pesticide: {
    show_quantity: true,
    quantity_key: 'quantity',
    default_unit: 'L',
    unit_options: ['L', 'ml', 'kg'],
  },
  irrigation: {
    show_quantity: true,
    quantity_key: 'duration',
    default_unit: 'hours',
    unit_options: ['hours', 'sessions'],
  },
  labor: {
    show_quantity: true,
    quantity_key: 'workers',
    default_unit: 'person-days',
    unit_options: ['person-days', 'days', 'hours'],
  },
  equipment: {
    show_quantity: false,
  },
  transport: {
    show_quantity: true,
    quantity_key: 'load',
    default_unit: 'trips',
    unit_options: ['trips', 'km', 'quintal'],
  },
  other: {
    show_quantity: true,
    quantity_key: 'quantity',
    default_unit: '',
    unit_options: null,
  },
};

export function getExpenseCategoryConfig(category) {
  return EXPENSE_CATEGORY_FIELDS[category] || EXPENSE_CATEGORY_FIELDS.other;
}

export function getExpenseFormDefaults(category = 'fertilizer') {
  const config = getExpenseCategoryConfig(category);

  return {
    category,
    title: '',
    amount: '',
    quantity: '',
    unit: config.show_quantity ? config.default_unit || '' : '',
    expense_date: new Date().toISOString().slice(0, 10),
    notes: '',
  };
}

export function applyExpenseCategoryChange(form, category) {
  const config = getExpenseCategoryConfig(category);

  return {
    ...form,
    category,
    quantity: config.show_quantity ? form.quantity : '',
    unit: config.show_quantity ? config.default_unit || '' : '',
  };
}
