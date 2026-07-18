/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary();
    table.string('phone', 15).notNullable().unique();
    table.string('name', 120).nullable();
    table.enum('preferred_language', ['en', 'hi']).notNullable().defaultTo('en');
    table.enum('preferred_land_unit', ['acre', 'hectare', 'bigha']).notNullable().defaultTo('acre');
    table.string('state_code', 10).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('last_login_at').nullable();
    table.timestamps(true, true);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('users');
};
