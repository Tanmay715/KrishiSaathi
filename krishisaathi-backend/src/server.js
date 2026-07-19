require('dotenv').config();

const app = require('./app');
const env = require('./config/env');
const redis = require('./config/redis');
const db = require('./db/connection');

async function startServer() {
  try {
    await db.raw('SELECT 1');
    console.log('[db] MySQL connected');

    try {
      const [batch, log] = await db.migrate.latest();
      if (log.length) {
        console.log(`[db] ran migrations: ${log.join(', ')}`);
      } else {
        console.log('[db] migrations up to date');
      }
    } catch (migrate_error) {
      console.error('[db] migration failed:', migrate_error.message);
      if (env.is_production) {
        throw migrate_error;
      }
    }

    try {
      await redis.connect();
      console.log('[redis] connected');
    } catch (redis_error) {
      if (env.is_production) {
        throw new Error(`Redis is required in production: ${redis_error.message}`);
      }

      console.warn('[redis] unavailable — OTP will fail until Redis is running');
    }

    app.listen(env.port, '0.0.0.0', () => {
      console.log(`[server] KrishiSaathi API running on port ${env.port}${env.api_prefix}`);
    });
  } catch (error) {
    console.error('[server] failed to start:', error.message);
    process.exit(1);
  }
}

startServer();
