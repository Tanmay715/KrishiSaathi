const Redis = require('ioredis');

function buildRedisClient() {
  const redis_url = process.env.REDIS_URL;
  if (redis_url) {
    return new Redis(redis_url, { maxRetriesPerRequest: 3, lazyConnect: true });
  }

  const redis_password = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD || undefined;

  return new Redis({
    host: process.env.REDIS_HOST || process.env.REDISHOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || process.env.REDISPORT || 6379),
    password: redis_password,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

const redis = buildRedisClient();

redis.on('error', (error) => {
  console.error('[redis] connection error:', error.message);
});

module.exports = redis;
