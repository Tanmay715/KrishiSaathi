# Fasalya Backend

Farm management REST API for Fasalya.

## Stack

- Node.js + Express
- MySQL 8 + Knex.js
- Redis (OTP sessions & rate limiting)
- JWT authentication

## Setup (recommended — Docker)

No local MySQL install needed. Uses Docker containers on ports **3307** (MySQL) and **6380** (Redis) so it won't conflict with office MySQL.

**Requires:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
cp .env.example .env
npm install
npm run docker:up      # start MySQL + Redis
npm run setup          # wait for DB, migrate, seed
npm run dev
```

Stop containers when done:

```bash
npm run docker:down
```

## Setup (without Docker)

If you already have MySQL and Redis locally, copy `.env.example` to `.env` and set `DB_HOST`, `DB_PORT`, `DB_PASSWORD`, and `REDIS_PORT` to match your setup.

API base URL: `http://localhost:4000/api/v1`

## Prerequisites

- Node.js 18+
- Docker Desktop (recommended for local MySQL + Redis)

## API Endpoints (v0.1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/auth/send-otp` | Send OTP to phone |
| POST | `/auth/verify-otp` | Verify OTP & login |
| GET | `/users/me` | Get profile |
| PATCH | `/users/me` | Update profile |
| GET | `/users/limits` | Farm/plot limits |
| GET/POST | `/farms` | List/create farms |
| GET/PATCH/DELETE | `/farms/:farm_id` | Farm CRUD |
| GET/POST | `/farms/:farm_id/plots` | List/create plots |
| PATCH/DELETE | `/farms/:farm_id/plots/:plot_id` | Plot CRUD |
| GET | `/activity` | Recent activity feed |

## Development

In development, OTP is logged to the console.
