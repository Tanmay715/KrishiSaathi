exports.up = async function up(knex) {
  await knex.schema.createTable('farm_reminders', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('farm_id').nullable().references('id').inTable('farms').onDelete('CASCADE');
    table.uuid('plot_id').nullable().references('id').inTable('plots').onDelete('SET NULL');
    table.uuid('crop_cycle_id').nullable().references('id').inTable('crop_cycles').onDelete('SET NULL');
    table.enu('type', ['irrigation', 'fertilizer', 'pesticide', 'harvest', 'weather', 'custom'])
      .notNullable()
      .defaultTo('custom');
    table.string('title', 200).notNullable();
    table.dateTime('due_at').notNullable();
    table.enu('status', ['pending', 'done', 'dismissed']).notNullable().defaultTo('pending');
    table.enu('source', ['manual', 'rule', 'weather']).notNullable().defaultTo('manual');
    table.json('payload').nullable();
    table.timestamps(true, true);

    table.index(['user_id', 'status', 'due_at']);
    table.index(['farm_id', 'status']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('farm_reminders');
};
