/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('crop_templates', (table) => {
    table.uuid('id').primary();
    table.string('name_en', 120).notNullable();
    table.string('name_hi', 120).notNullable();
    table.enum('category', [
      'cereal',
      'pulse',
      'oilseed',
      'vegetable',
      'fruit',
      'cash_crop',
      'other',
    ]).notNullable().defaultTo('other');
    table.json('default_stages').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('crop_templates');
};
