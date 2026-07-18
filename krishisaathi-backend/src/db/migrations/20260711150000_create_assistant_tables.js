/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('assistant_threads', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('title', 150).nullable();
    table.timestamps(true, true);

    table.index(['user_id', 'updated_at']);
  });

  await knex.schema.createTable('assistant_messages', (table) => {
    table.uuid('id').primary();
    table.uuid('thread_id').notNullable().references('id').inTable('assistant_threads').onDelete('CASCADE');
    table.enum('role', ['user', 'assistant', 'system']).notNullable();
    table.text('content').notNullable();
    table.timestamps(true, true);

    table.index(['thread_id', 'created_at']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('assistant_messages');
  await knex.schema.dropTableIfExists('assistant_threads');
};
