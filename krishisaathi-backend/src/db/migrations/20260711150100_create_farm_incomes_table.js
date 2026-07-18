/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('farm_incomes', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('farm_id').notNullable().references('id').inTable('farms').onDelete('CASCADE');
    table.uuid('plot_id').nullable().references('id').inTable('plots').onDelete('SET NULL');
    table.uuid('crop_cycle_id').nullable().references('id').inTable('crop_cycles').onDelete('SET NULL');
    table
      .enum('category', ['harvest', 'sale', 'subsidy', 'other'])
      .notNullable()
      .defaultTo('other');
    table.string('title', 150).notNullable();
    table.decimal('amount', 12, 2).notNullable();
    table.decimal('quantity', 12, 2).nullable();
    table.string('unit', 40).nullable();
    table.date('income_date').notNullable();
    table.text('notes').nullable();
    table.timestamps(true, true);

    table.index(['user_id', 'income_date']);
    table.index(['farm_id', 'income_date']);
    table.index(['plot_id']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('farm_incomes');
};
