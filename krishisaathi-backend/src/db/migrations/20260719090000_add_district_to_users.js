exports.up = async function up(knex) {
  const has_district = await knex.schema.hasColumn('users', 'district');
  if (!has_district) {
    await knex.schema.alterTable('users', (table) => {
      table.string('district', 120).nullable();
    });
  }
};

exports.down = async function down(knex) {
  const has_district = await knex.schema.hasColumn('users', 'district');
  if (has_district) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('district');
    });
  }
};
