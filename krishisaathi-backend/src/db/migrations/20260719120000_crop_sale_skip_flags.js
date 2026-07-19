/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('crop_cycles', (table) => {
    table.boolean('skip_sale_income').notNullable().defaultTo(false);
    table.boolean('track_expenses').notNullable().defaultTo(true);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('crop_cycles', (table) => {
    table.dropColumn('skip_sale_income');
    table.dropColumn('track_expenses');
  });
};
