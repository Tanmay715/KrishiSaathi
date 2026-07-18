#!/usr/bin/env bash
set -euo pipefail

echo "[setup] Waiting for MySQL to be ready..."
for i in $(seq 1 30); do
  if docker compose exec -T mysql mysqladmin ping -h 127.0.0.1 -pkrishisaathi --silent 2>/dev/null; then
    echo "[setup] MySQL is ready"
    break
  fi
  echo "[setup] waiting... ($i/30)"
  sleep 2
done

npm run db:check
npm run migrate
npm run seed

echo "[setup] Done. Run: npm run dev"
