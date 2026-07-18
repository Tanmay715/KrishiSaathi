/** Crop-aware day offsets after sowing for rule-generated reminders. */
const CATEGORY_RULES = {
  cereal: [
    { type: 'irrigation', days_after_sowing: 7, title_en: 'First irrigation check', title_hi: 'पहली सिंचाई जाँच' },
    { type: 'fertilizer', days_after_sowing: 25, title_en: 'Fertilizer application window', title_hi: 'उर्वरक डालने का समय' },
    { type: 'pesticide', days_after_sowing: 40, title_en: 'Pest scout / spray review', title_hi: 'कीट जाँच / छिड़काव' },
    { type: 'harvest', days_after_sowing: 120, title_en: 'Harvest readiness check', title_hi: 'कटाई तैयारी जाँच' },
  ],
  pulse: [
    { type: 'irrigation', days_after_sowing: 10, title_en: 'Irrigation check', title_hi: 'सिंचाई जाँच' },
    { type: 'fertilizer', days_after_sowing: 20, title_en: 'Nutrient / rhizobium check', title_hi: 'पोषक तत्व जाँच' },
    { type: 'pesticide', days_after_sowing: 30, title_en: 'Pest scout', title_hi: 'कीट जाँच' },
    { type: 'harvest', days_after_sowing: 90, title_en: 'Harvest readiness check', title_hi: 'कटाई तैयारी जाँच' },
  ],
  oilseed: [
    { type: 'irrigation', days_after_sowing: 8, title_en: 'Irrigation check', title_hi: 'सिंचाई जाँच' },
    { type: 'fertilizer', days_after_sowing: 22, title_en: 'Fertilizer window', title_hi: 'उर्वरक समय' },
    { type: 'pesticide', days_after_sowing: 35, title_en: 'Aphid / pest scout', title_hi: 'कीट जाँच' },
    { type: 'harvest', days_after_sowing: 110, title_en: 'Harvest readiness check', title_hi: 'कटाई तैयारी जाँच' },
  ],
  vegetable: [
    { type: 'irrigation', days_after_sowing: 3, title_en: 'Frequent irrigation check', title_hi: 'नियमित सिंचाई जाँच' },
    { type: 'fertilizer', days_after_sowing: 14, title_en: 'Top dressing window', title_hi: 'उर्वरक डालने का समय' },
    { type: 'pesticide', days_after_sowing: 18, title_en: 'Pest / disease scout', title_hi: 'कीट / बीमारी जाँच' },
    { type: 'harvest', days_after_sowing: 70, title_en: 'Harvest readiness check', title_hi: 'कटाई तैयारी जाँच' },
  ],
  cash: [
    { type: 'irrigation', days_after_sowing: 10, title_en: 'Irrigation check', title_hi: 'सिंचाई जाँच' },
    { type: 'fertilizer', days_after_sowing: 30, title_en: 'Fertilizer application window', title_hi: 'उर्वरक डालने का समय' },
    { type: 'pesticide', days_after_sowing: 45, title_en: 'Pest scout / spray review', title_hi: 'कीट जाँच / छिड़काव' },
    { type: 'harvest', days_after_sowing: 150, title_en: 'Harvest readiness check', title_hi: 'कटाई तैयारी जाँच' },
  ],
  default: [
    { type: 'irrigation', days_after_sowing: 7, title_en: 'First irrigation check', title_hi: 'पहली सिंचाई जाँच' },
    { type: 'fertilizer', days_after_sowing: 21, title_en: 'Fertilizer application window', title_hi: 'उर्वरक डालने का समय' },
    { type: 'pesticide', days_after_sowing: 35, title_en: 'Pest scout / spray review', title_hi: 'कीट जाँच / छिड़काव' },
    { type: 'harvest', days_after_sowing: 110, title_en: 'Harvest readiness check', title_hi: 'कटाई तैयारी जाँच' },
  ],
};

const NAME_CATEGORY_HINTS = [
  { category: 'cereal', keywords: ['wheat', 'rice', 'paddy', 'gehun', 'gehu', 'dhan', 'makka', 'maize', 'jowar', 'bajra', 'गेहूँ', 'गेहूं', 'धान', 'मक्का'] },
  { category: 'pulse', keywords: ['moong', 'chana', 'urad', 'arhar', 'masoor', 'tur', 'dal', 'मूँग', 'चना', 'उड़द', 'अरहर', 'मसूर'] },
  { category: 'oilseed', keywords: ['mustard', 'sarson', 'groundnut', 'soy', 'til', 'sesame', 'सरसों', 'मूंगफली'] },
  { category: 'vegetable', keywords: ['potato', 'aloo', 'tomato', 'onion', 'chili', 'chilli', 'brinjal', 'cabbage', 'आलू', 'टमाटर', 'प्याज'] },
  { category: 'cash', keywords: ['cotton', 'sugarcane', 'kapas', 'ganna', 'कपास', 'गन्ना'] },
];

function detectCropCategory(crop_name = '', template_category = null) {
  if (template_category && CATEGORY_RULES[template_category]) {
    return template_category;
  }

  const name = String(crop_name || '').toLowerCase();

  for (const hint of NAME_CATEGORY_HINTS) {
    if (hint.keywords.some((word) => name.includes(word.toLowerCase()))) {
      return hint.category;
    }
  }

  return 'default';
}

function addDays(date_value, days) {
  const date = new Date(date_value);
  date.setDate(date.getDate() + days);
  return date;
}

function buildRuleReminders(crop, language = 'en') {
  if (!crop.sowing_date) {
    return [];
  }

  const use_hi = language === 'hi';
  const category = detectCropCategory(crop.crop_name, crop.category);
  const rules = CATEGORY_RULES[category] || CATEGORY_RULES.default;

  return rules.map((rule) => {
    let due_at = addDays(crop.sowing_date, rule.days_after_sowing);

    if (rule.type === 'harvest' && crop.expected_harvest_date) {
      due_at = addDays(crop.expected_harvest_date, -7);
    }

    return {
      type: rule.type,
      title: use_hi ? rule.title_hi : rule.title_en,
      due_at,
      source: 'rule',
      payload: {
        crop_name: crop.crop_name,
        days_after_sowing: rule.days_after_sowing,
        category,
      },
      farm_id: crop.farm_id,
      plot_id: crop.plot_id,
      crop_cycle_id: crop.id,
    };
  });
}

module.exports = {
  CATEGORY_RULES,
  DEFAULT_RULES: CATEGORY_RULES.default,
  buildRuleReminders,
  detectCropCategory,
  addDays,
};
