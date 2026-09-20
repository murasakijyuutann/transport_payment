# Phase 0 — Setup & Skeleton

**Duration estimate:** 1–2 days  
**Depends on:** nothing  
**Unlocks:** Phase 1  
**Deliverable:** `GET /api/health` returns `{ "status": "ok" }`; Vite frontend loads in the browser.

---

## 1. Why this phase exists

Before any domain code, lock in:

1. **Project layout** that matches the target architecture (routes / services / domain / db).
2. **TypeScript strictness** so later money and journey bugs surface at compile time.
3. **DB connectivity** so Phase 1 migrations are not blocked by tooling fights.
4. **Frontend proxy** so the UI never hardcodes backend ports incorrectly.

Skipping a clean skeleton leads to “god files” (`index.ts` with routes + SQL + fare logic) that are hard to unwind once Phase 2–4 land.

---

## 2. Target directory layout

Create this structure (empty stubs are fine):

```text
transport_payment/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   └── health.ts
│   │   ├── services/          # empty for now
│   │   ├── domain/            # empty for now
│   │   ├── db/
│   │   │   ├── schema.ts      # minimal stub table optional
│   │   │   ├── index.ts       # pool + drizzle client
│   │   │   └── migrations/
│   │   ├── middleware/
│   │   │   └── errorHandler.ts
│   │   ├── shared/
│   │   │   └── types.ts
│   │   ├── config/
│   │   │   └── env.ts
│   │   ├── app.ts             # Express app (no listen)
│   │   └── server.ts          # listen + start
│   ├── drizzle.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── main.ts
│   │   ├── api.ts             # stub: fetchHealth()
│   │   └── types.ts
│   ├── vite.config.ts
│   ├── package.json
│   └── tsconfig.json
│
└── execution_plans/           # these docs
```

### Why split `app.ts` and `server.ts`

- `app.ts` exports the Express instance → Supertest can import it in Phase 8 without binding a port.
- `server.ts` is the only place that calls `listen()` and starts cron (Phase 6).

```typescript
// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', healthRouter);
  app.use(errorHandler);
  return app;
}
```

```typescript
// backend/src/server.ts
import { createApp } from './app';
import { env } from './config/env';

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT}`);
});
```

---

## 3. Ordered work checklist

Do these steps in order. Do not jump ahead to User/Journey tables.

### Step 0.1 — Database isolation from Spring Boot

Existing Java app uses Flyway on `transportdb`. Avoid sharing the same schema.

**Preferred approach:** add a second database in Postgres (same container):

```sql
CREATE DATABASE transport_abt OWNER transport_user;
```

Or extend `docker-compose.yml` with a second service / init script. Document the URL:

```env
DATABASE_URL=postgresql://transport_user:your_password@localhost:5432/transport_abt
```

**Why:** Flyway history tables and ABT Drizzle migrations must not fight over the same `public` schema.

### Step 0.2 — Backend package init

```bash
mkdir -p backend && cd backend
npm init -y
npm install express cors dotenv pg drizzle-orm zod
npm install -D typescript tsx @types/express @types/cors @types/node drizzle-kit
```

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

### Step 0.3 — TypeScript config (strict)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

**Why `strict` + `noUncheckedIndexedAccess` now:** fare and wallet code later does a lot of map lookups; catching `T | undefined` early prevents silent `NaN` money bugs.

### Step 0.4 — Env loading

```typescript
// backend/src/config/env.ts
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16).default('dev-only-change-me-32chars!!'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = schema.parse(process.env);
```

**Why Zod for env:** fail fast at boot if `DATABASE_URL` is missing instead of cryptic `pg` connection errors mid-request.

### Step 0.5 — Drizzle connection + stub schema

```typescript
// backend/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

```typescript
// backend/src/db/schema.ts
// Phase 0: intentionally empty or a tiny _meta table.
// Real tables arrive in Phase 1+.
export {};
```

`drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

### Step 0.6 — Health route + error middleware

```typescript
// backend/src/routes/health.ts
import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
```

```typescript
// backend/src/middleware/errorHandler.ts
import type { ErrorRequestHandler } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
```

**Why introduce `AppError` in Phase 0:** every later phase throws domain failures the same way (`404 MEDIA_NOT_FOUND`, `409 JOURNEY_ALREADY_OPEN`). One handler keeps API error shape stable for the frontend.

### Step 0.7 — Frontend Vite init

```bash
npm create vite@latest frontend -- --template vanilla-ts
cd frontend && npm install
```

`vite.config.ts`:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

Stub `frontend/src/api.ts`:

```typescript
export async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('health failed');
  return res.json();
}
```

Show status on the default page so you can verify the proxy without Postman.

### Step 0.8 — Root / ignore hygiene

- Add `backend/.env` to `.gitignore` (never commit secrets).
- Commit `backend/.env.example` and `frontend` without secrets.
- Do **not** delete the Java `src/` tree in this phase.

---

## 4. Code scaffolding summary

| File | Responsibility |
|------|----------------|
| `config/env.ts` | Typed env |
| `db/index.ts` | Pool + Drizzle |
| `db/schema.ts` | Empty until Phase 1 |
| `routes/health.ts` | Smoke test |
| `middleware/errorHandler.ts` | Stable error JSON |
| `app.ts` / `server.ts` | Testable app vs process entry |
| `frontend/src/api.ts` | Single place for `fetch` |

---

## 5. Architectural rules established here (keep forever)

1. **Routes are thin** — parse request, call service, return JSON. No SQL in routes.
2. **Services orchestrate** — DB + domain calls.
3. **Domain is pure** — no Express, no Drizzle imports under `domain/` (enforced from Phase 2+).
4. **Money is never float in business logic** — when amounts appear (Phase 3+), use `NUMERIC` in DB and `string` or integer minor units in TS; decide in Phase 3 and stick to it. Recommendation: store as `numeric` / read via Drizzle as `string`, compute with a small decimal helper or integer pence.

---

## 6. Acceptance criteria

- [ ] `docker compose up -d` Postgres running; `transport_abt` (or chosen DB) exists
- [ ] `cd backend && npm run dev` → `GET http://localhost:3000/api/health` → `{ "status": "ok" }`
- [ ] `cd frontend && npm run dev` → browser loads; health fetch via proxy succeeds
- [ ] `tsconfig` has `"strict": true`
- [ ] `.env.example` documents `DATABASE_URL`, `JWT_SECRET`, `PORT`

## 7. Explicitly out of scope

- Auth, users, stations, taps, fares
- Redis (Java stack used it; ABT v1 does not need it)
- Porting any Spring controllers

## 8. Handoff notes for Phase 1

Phase 1 will fill `schema.ts` with account + network tables and add `routes/auth.ts`, `routes/account.ts`. Keep folder conventions from this phase unchanged.
