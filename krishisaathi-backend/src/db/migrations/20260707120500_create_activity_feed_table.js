/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('activity_feed', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('entity_type', 50).notNullable();
    table.uuid('entity_id').nullable();
    table.string('action', 80).notNullable();
    table.string('summary', 255).notNullable();
    table.json('metadata').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['user_id', 'created_at']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('activity_feed');
};
