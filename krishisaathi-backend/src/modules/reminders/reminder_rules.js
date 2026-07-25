/** Crop-aware day offsets after sowing for rule-generated reminders. */
const IRRIGATION_FIRST = { key: 'irrigation_first', title_en: 'First irrigation check', title_hi: 'पहली सिंचाई जाँच' };
const IRRIGATION_CHECK = { key: 'irrigation_check', title_en: 'Irrigation check', title_hi: 'सिंचाई जाँच' };
const IRRIGATION_FREQUENT = { key: 'irrigation_frequent', title_en: 'Frequent irrigation check', title_hi: 'नियमित सिंचाई जाँच' };
const FERTILIZER_WINDOW = { key: 'fertilizer_window', title_en: 'Fertilizer application window', title_hi: 'उर्वरक डालने का समय' };
const FERTILIZER_TIME = { key: 'fertilizer_time', title_en: 'Fertilizer window', title_hi: 'उर्वरक समय' };
const NUTRIENT_CHECK = { key: 'nutrient_check', title_en: 'Nutrient / rhizobium check', title_hi: 'पोषक तत्व जाँच' };
const TOP_DRESSING = { key: 'top_dressing', title_en: 'Top dressing window', title_hi: 'उर्वरक डालने का समय' };
const PEST_SCOUT_SPRAY = { key: 'pest_scout_spray', title_en: 'Pest scout / spray review', title_hi: 'कीट जाँच / छिड़काव' };
const PEST_SCOUT = { key: 'pest_scout', title_en: 'Pest scout', title_hi: 'कीट जाँच' };
const APHID_SCOUT = { key: 'aphid_scout', title_en: 'Aphid / pest scout', title_hi: 'कीट जाँच' };
const PEST_DISEASE_SCOUT = { key: 'pest_disease_scout', title_en: 'Pest / disease scout', title_hi: 'कीट / बीमारी जाँच' };
const HARVEST_CHECK = { key: 'harvest_check', title_en: 'Harvest readiness check', title_hi: 'कटाई तैयारी जाँच' };

const CATEGORY_RULES = {
  cereal: [
    { type: 'irrigation', days_after_sowing: 7, ...IRRIGATION_FIRST },
    { type: 'fertilizer', days_after_sowing: 25, ...FERTILIZER_WINDOW },
    { type: 'pesticide', days_after_sowing: 40, ...PEST_SCOUT_SPRAY },
    { type: 'harvest', days_after_sowing: 120, ...HARVEST_CHECK },
  ],
  pulse: [
    { type: 'irrigation', days_after_sowing: 10, ...IRRIGATION_CHECK },
    { type: 'fertilizer', days_after_sowing: 20, ...NUTRIENT_CHECK },
    { type: 'pesticide', days_after_sowing: 30, ...PEST_SCOUT },
    { type: 'harvest', days_after_sowing: 90, ...HARVEST_CHECK },
  ],
  oilseed: [
    { type: 'irrigation', days_after_sowing: 8, ...IRRIGATION_CHECK },
    { type: 'fertilizer', days_after_sowing: 22, ...FERTILIZER_TIME },
    { type: 'pesticide', days_after_sowing: 35, ...APHID_SCOUT },
    { type: 'harvest', days_after_sowing: 110, ...HARVEST_CHECK },
  ],
  vegetable: [
    { type: 'irrigation', days_after_sowing: 3, ...IRRIGATION_FREQUENT },
    { type: 'fertilizer', days_after_sowing: 14, ...TOP_DRESSING },
    { type: 'pesticide', days_after_sowing: 18, ...PEST_DISEASE_SCOUT },
    { type: 'harvest', days_after_sowing: 70, ...HARVEST_CHECK },
  ],
  cash: [
    { type: 'irrigation', days_after_sowing: 10, ...IRRIGATION_CHECK },
    { type: 'fertilizer', days_after_sowing: 30, ...FERTILIZER_WINDOW },
    { type: 'pesticide', days_after_sowing: 45, ...PEST_SCOUT_SPRAY },
    { type: 'harvest', days_after_sowing: 150, ...HARVEST_CHECK },
  ],
  default: [
    { type: 'irrigation', days_after_sowing: 7, ...IRRIGATION_FIRST },
    { type: 'fertilizer', days_after_sowing: 21, ...FERTILIZER_WINDOW },
    { type: 'pesticide', days_after_sowing: 35, ...PEST_SCOUT_SPRAY },
    { type: 'harvest', days_after_sowing: 110, ...HARVEST_CHECK },
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
        // Stored so the app can re-render the title in whichever language is active later.
        title_key: rule.key,
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
