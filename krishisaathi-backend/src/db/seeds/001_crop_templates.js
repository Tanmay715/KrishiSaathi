const { v4: uuidv4 } = require('uuid');

const crop_templates = [
  {
    name_en: 'Wheat',
    name_hi: 'गेहूं',
    category: 'cereal',
    default_stages: ['Land preparation', 'Sowing', 'Irrigation', 'Fertilizer', 'Harvest'],
  },
  {
    name_en: 'Rice',
    name_hi: 'धान',
    category: 'cereal',
    default_stages: ['Nursery', 'Transplanting', 'Irrigation', 'Fertilizer', 'Harvest'],
  },
  {
    name_en: 'Cotton',
    name_hi: 'कपास',
    category: 'cash_crop',
    default_stages: ['Sowing', 'Irrigation', 'Pest control', 'Flowering', 'Harvest'],
  },
  {
    name_en: 'Sugarcane',
    name_hi: 'गन्ना',
    category: 'cash_crop',
    default_stages: ['Planting', 'Irrigation', 'Fertilizer', 'Growth', 'Harvest'],
  },
  {
    name_en: 'Mustard',
    name_hi: 'सरसों',
    category: 'oilseed',
    default_stages: ['Sowing', 'Irrigation', 'Fertilizer', 'Harvest'],
  },
  {
    name_en: 'Potato',
    name_hi: 'आलू',
    category: 'vegetable',
    default_stages: ['Planting', 'Earthing up', 'Irrigation', 'Harvest'],
  },
  {
    name_en: 'Moong',
    name_hi: 'मूंग',
    category: 'pulse',
    default_stages: ['Land preparation', 'Sowing', 'Weeding', 'Irrigation', 'Harvest'],
  },
  {
    name_en: 'Chana',
    name_hi: 'चना',
    category: 'pulse',
    default_stages: ['Land preparation', 'Sowing', 'Irrigation', 'Pest control', 'Harvest'],
  },
  {
    name_en: 'Urad',
    name_hi: 'उड़द',
    category: 'pulse',
    default_stages: ['Land preparation', 'Sowing', 'Weeding', 'Irrigation', 'Harvest'],
  },
  {
    name_en: 'Arhar',
    name_hi: 'अरहर',
    category: 'pulse',
    default_stages: ['Land preparation', 'Sowing', 'Weeding', 'Pest control', 'Harvest'],
  },
  {
    name_en: 'Masoor',
    name_hi: 'मसूर',
    category: 'pulse',
    default_stages: ['Land preparation', 'Sowing', 'Irrigation', 'Harvest'],
  },
];

/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function seed(knex) {
  await knex('crop_templates').del();

  const rows = crop_templates.map((crop) => ({
    id: uuidv4(),
    ...crop,
    default_stages: JSON.stringify(crop.default_stages),
    is_active: true,
  }));

  await knex('crop_templates').insert(rows);
};
