require('dotenv').config();

const knex = require('knex');
const knex_config = require('../knexfile');

async function checkDatabase() {
  const env = process.env.NODE_ENV || 'development';
  const config = knex_config[env] || knex_config.development;
  const db = knex(config);

  if (!process.env.DB_PASSWORD) {
    console.error('\n[db] DB_PASSWORD is empty in .env');
    console.error('[db] Your local MySQL root user requires a password.');
    console.error('[db] Set DB_PASSWORD in krishisaathi-backend/.env and retry.\n');
    process.exit(1);
  }

  try {
    await db.raw('SELECT 1');
    console.log('[db] Connection successful');

    const db_name = process.env.DB_NAME || 'krishisaathi';
    await db.raw(`CREATE DATABASE IF NOT EXISTS \`${db_name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`[db] Database "${db_name}" is ready`);
    process.exit(0);
  } catch (error) {
    console.error('\n[db] Connection failed:', error.message);

    if (error.message.includes('Access denied')) {
      console.error('[db] Check DB_USER and DB_PASSWORD in .env');
    }

    console.error('');
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

checkDatabase();
