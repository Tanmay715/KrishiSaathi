/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('crop_cycles', (table) => {
    table.uuid('id').primary();
    table.uuid('plot_id').notNullable().references('id').inTable('plots').onDelete('CASCADE');
    table.uuid('crop_template_id').nullable().references('id').inTable('crop_templates').onDelete('SET NULL');
    table.string('crop_name', 150).notNullable();
    table.enum('season_type', ['rabi', 'kharif', 'zaid', 'custom']).notNullable().defaultTo('custom');
    table.date('season_start_date').nullable();
    table.date('season_end_date').nullable();
    table.date('sowing_date').nullable();
    table.date('expected_harvest_date').nullable();
    table.date('actual_harvest_date').nullable();
    table.enum('status', ['planned', 'active', 'harvested', 'abandoned']).notNullable().defaultTo('planned');
    table.json('lifecycle_stages').nullable();
    table.text('notes').nullable();
    table.timestamps(true, true);

    table.index(['plot_id', 'status']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('crop_cycles');
};
