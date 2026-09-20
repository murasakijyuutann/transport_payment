# Phase 0 Audit — Setup & Skeleton

**Date:** 2026-09-20  
**Plan:** [`phase_0_execution_plan.md`](phase_0_execution_plan.md)  
**Outcome:** Phase 0 accepted with one environmental caveat (Postgres / `transport_abt` not verified — Docker Desktop was unavailable during the session).

---

## 1. Summary

Greenfield ABT skeleton was added beside the existing Spring Boot prototype:

- `backend/` — Express + TypeScript + Drizzle wiring + health API
- `frontend/` — Vite vanilla-ts page that calls `/api/health` through a proxy
- Docker init SQL to create an isolated `transport_abt` database
- Root `.gitignore` / README updates for the new stack

No domain tables, auth, taps, or fares were implemented (correctly out of scope).

---

## 2. What was created

### 2.1 Backend (`backend/`)

| Path | Purpose |
|------|---------|
| `package.json` | Scripts: `dev`, `build`, `start`, `db:generate`, `db:migrate` |
| `tsconfig.json` | `strict: true`, `noUncheckedIndexedAccess: true`, `module: NodeNext` |
| `drizzle.config.ts` | Schema path, migrations out dir, PostgreSQL dialect |
| `.env.example` | `PORT`, `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV` |
| `.env` | Local copy (gitignored) — same defaults as example |
| `src/config/env.ts` | Zod-validated env; fails fast if `DATABASE_URL` missing |
| `src/db/schema.ts` | Empty stub (`export {}`) — tables in Phase 1 |
| `src/db/index.ts` | `pg.Pool` + Drizzle client |
| `src/db/migrations/.gitkeep` | Placeholder for generated SQL |
| `src/routes/health.ts` | `GET /health` → `{ status: "ok" }` |
| `src/middleware/errorHandler.ts` | `AppError` + JSON error handler |
| `src/shared/types.ts` | `HealthResponse` starter type |
| `src/app.ts` | `createApp()` — no `listen` (Supertest-ready later) |
| `src/server.ts` | Process entry — `listen(env.PORT)` |
| `src/services/.gitkeep` | Folder reserved for Phase 1+ |
| `src/domain/.gitkeep` | Folder reserved for Phase 2+ |

**Dependencies installed:** `express`, `cors`, `dotenv`, `pg`, `drizzle-orm`, `zod`  
**DevDependencies:** `typescript`, `tsx`, `@types/*`, `drizzle-kit`

**Import style:** ESM with `.js` extensions in relative imports (NodeNext).

### 2.2 Frontend (`frontend/`)

| Path | Purpose |
|------|---------|
| `package.json` | `dev` / `build` / `preview` |
| `tsconfig.json` | `strict: true`, bundler resolution |
| `vite.config.ts` | Port `5173`; proxy `/api` → `http://localhost:3000` |
| `index.html` | Skeleton landing page |
| `src/main.ts` | Loads health status into the page |
| `src/api.ts` | `fetchHealth()` |
| `src/types.ts` | `HealthResponse` |
| `src/style.css` | Minimal page styling |
| `src/vite-env.d.ts` | Vite client types |

**DevDependencies:** `vite`, `typescript`

### 2.3 Infrastructure / repo hygiene

| Path | Change |
|------|--------|
| `docker-compose.yml` | Mounts `docker/postgres/init-abt-db.sql` into Postgres init |
| `docker/postgres/init-abt-db.sql` | Creates `transport_abt` owned by `transport_user` if missing |
| `.gitignore` | `node_modules/`, `backend/dist/`, `frontend/dist/`, `backend/.env`, logs |
| `README.md` | Status → Phase 0 done; “Running Phase 0” instructions |

Legacy Java tree under `src/` was left untouched.

---

## 3. Work checklist vs plan

| Step | Plan item | Done? | Notes |
|------|-----------|-------|-------|
| 0.1 | DB isolation (`transport_abt`) | Partial | Init SQL + compose mount added; DB not confirmed running (Docker down) |
| 0.2 | Backend package init | Yes | |
| 0.3 | Strict TypeScript | Yes | |
| 0.4 | Zod env loading | Yes | |
| 0.5 | Drizzle connection + stub schema | Yes | Pool ready; no migrations generated (empty schema) |
| 0.6 | Health route + `AppError` middleware | Yes | |
| 0.7 | Vite frontend + proxy + health UI | Yes | Manual scaffold (not `npm create vite` interactive) |
| 0.8 | `.gitignore` / `.env.example` | Yes | `.env` present locally, ignored |

---

## 4. Verification performed

| Check | Result |
|-------|--------|
| `GET http://localhost:3000/api/health` | `{"status":"ok"}` |
| `GET http://localhost:5173/api/health` (Vite proxy) | `{"status":"ok"}` |
| `GET http://localhost:5173/` | HTTP 200 |
| Backend `npx tsc --noEmit` | Pass |
| Frontend `npm run build` (`tsc` + `vite build`) | Pass |
| `docker compose up -d postgres` | **Failed** — Docker Desktop engine pipe unavailable |
| `transport_abt` exists | **Not verified** |

Health does not import `db`, so the API runs without Postgres. Phase 1 will require a live `DATABASE_URL`.

---

## 5. Decisions made during implementation

1. **ESM (`"type": "module"`)** with NodeNext — matches modern Node/TS defaults used by Drizzle tooling.
2. **Separate DB name `transport_abt`** — avoids Flyway / Spring tables in `transportdb`.
3. **SQL init file** instead of a shell script — simpler for the official Postgres image entrypoint.
4. **Frontend scaffolded by hand** — same layout as the plan; avoided interactive `create-vite` prompts.
5. **`.env` created for local dev** — not committed; `.env.example` is the template.
6. **No Drizzle migration generated** — empty schema would produce nothing useful; first real migration is Phase 1.

---

## 6. Acceptance criteria scorecard

From [`phase_0_execution_plan.md`](phase_0_execution_plan.md) §6:

| Criterion | Status |
|-----------|--------|
| Postgres up; `transport_abt` exists | **Open** — start Docker, then create DB if volume predates init script |
| Backend health → `{ status: "ok" }` | **Met** |
| Frontend loads; health via proxy | **Met** |
| `tsconfig` strict | **Met** (backend + frontend) |
| `.env.example` documents keys | **Met** |

---

## 7. Follow-ups before / during Phase 1

1. Start Docker Desktop and run:
   ```bash
   docker compose up -d postgres
   ```
2. If the Postgres volume already existed before the init SQL was added:
   ```bash
   docker exec -it transport-postgres psql -U transport_user -d postgres \
     -c "CREATE DATABASE transport_abt OWNER transport_user;"
   ```
3. Confirm connectivity with the URL in `backend/.env`:
   `postgresql://transport_user:your_password@localhost:5432/transport_abt`
4. Proceed with Phase 1 schema, seed, auth, and account/wallet routes per [`phase_1_execution_plan.md`](phase_1_execution_plan.md).

---

## 8. Explicitly not done (by design)

- Auth, users, transit accounts, fare media, stations
- Tap / journey / fare / wallet ledger logic
- Redis usage
- Porting Spring controllers
- Committing secrets or removing the Java prototype

---

## 9. How to re-run Phase 0 smoke test

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev

# Checks
curl http://localhost:3000/api/health
curl http://localhost:5173/api/health
```

Expected both: `{"status":"ok"}`.
