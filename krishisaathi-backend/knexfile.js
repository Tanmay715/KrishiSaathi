require('dotenv').config();

function buildDbConnection() {
  const mysql_url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (mysql_url) {
    return mysql_url;
  }

  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'krishisaathi',
    timezone: '+05:30',
  };
}

const base_config = {
  client: 'mysql2',
  connection: buildDbConnection(),
  pool: { min: 2, max: 10 },
  migrations: {
    directory: './src/db/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/db/seeds',
  },
};

module.exports = {
  development: base_config,
  production: base_config,
  test: {
    ...base_config,
    connection: { ...base_config.connection, database: 'krishisaathi_test' },
  },
};
