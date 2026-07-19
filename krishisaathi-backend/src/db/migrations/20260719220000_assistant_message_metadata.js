/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('assistant_messages', (table) => {
    table.json('metadata').nullable().after('content');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('assistant_messages', (table) => {
    table.dropColumn('metadata');
  });
};
