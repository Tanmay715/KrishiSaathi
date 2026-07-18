const { v4: uuidv4 } = require('uuid');

const PULSE_TEMPLATES = [
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
exports.up = async function up(knex) {
  for (const crop of PULSE_TEMPLATES) {
    const existing = await knex('crop_templates').where({ name_en: crop.name_en }).first();

    if (existing) {
      continue;
    }

    await knex('crop_templates').insert({
      id: uuidv4(),
      name_en: crop.name_en,
      name_hi: crop.name_hi,
      category: crop.category,
      default_stages: JSON.stringify(crop.default_stages),
      is_active: true,
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const names = PULSE_TEMPLATES.map((crop) => crop.name_en);
  await knex('crop_templates').whereIn('name_en', names).del();
};
