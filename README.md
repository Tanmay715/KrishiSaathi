# Fasalya

Farm management platform for Indian farmers — monorepo workspace with two independent repositories.

## Repositories

| Repo | Description | Port |
|------|-------------|------|
| [krishisaathi-backend](./krishisaathi-backend) | REST API (Express, MySQL, Redis) | 4000 |
| [krishisaathi-frontend](./krishisaathi-frontend) | Web app (React, Vite) | 5173 |

## Quick start

### Backend

```bash
cd krishisaathi-backend
cp .env.example .env
npm install
npm run docker:up    # MySQL on :3307, Redis on :6380
npm run migrate
npm run seed
npm run dev
```

### Frontend

```bash
cd krishisaathi-frontend
cp .env.example .env
npm install
npm run dev
```

## v0.1 features implemented

- Phone OTP authentication (JWT)
- User profile (language, land unit)
- Farms & plots CRUD (edit/delete in UI)
- Crop cycles with lifecycle stages
- Crop templates: cereals, cash crops, oilseeds, vegetables, pulses
- Input & expense logging
- Income logging (harvest / sale / subsidy)
- **Farm Assistant** chat (OpenAI, farm-aware, EN/HI)
- Weather advisory strip (Open-Meteo, Redis-cached)
- Activity feed
- English + Hindi UI
- Dashboard with spend / earn / net stats

## Farm Assistant setup

Add to `krishisaathi-backend/.env`:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

## Next phases

- Irrigation / fertilizer / pesticide detailed logs
- Full P&L reports
- Inventory, labor, equipment
- Offline read
