exports.up = async function up(knex) {
  await knex.schema.createTable('disease_scans', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('farm_id').notNullable().references('id').inTable('farms').onDelete('CASCADE');
    table.uuid('plot_id').nullable().references('id').inTable('plots').onDelete('SET NULL');
    table.uuid('crop_cycle_id').nullable().references('id').inTable('crop_cycles').onDelete('SET NULL');
    table.string('image_path', 500).notNullable();
    table.string('status', 30).notNullable().defaultTo('completed');
    table.json('diagnosis_json').nullable();
    table.decimal('confidence', 5, 4).nullable();
    table.string('model', 80).nullable();
    table.timestamps(true, true);

    table.index(['user_id', 'created_at']);
    table.index(['farm_id', 'created_at']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('disease_scans');
};
