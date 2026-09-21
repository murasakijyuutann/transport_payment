# Troubleshooting — Local Postgres & Integration Tests

Notes from real local failures while running `cd backend && npm test` / `docker compose up -d postgres`.

---

## Quick checklist

1. Is **Docker Desktop** running?
2. Is **this repo’s** Postgres up? `docker compose ps` → `transport-postgres` **healthy**
3. Is something else on **:5432**? See [Port already allocated](#port-5432-already-allocated)
4. Does `backend/.env` `DATABASE_URL` match `docker-compose.yml` password? (default `your_password`)
5. Unit tests only: `npm run test:unit` (no DB)

---

## Symptom: `password authentication failed for user "transport_user"` (`28P01`)

**Meaning:** Something accepted the TCP connection on `:5432`, then rejected the password. This is **not** “Postgres is down.”

### Common causes

| Cause | What happens |
|-------|----------------|
| Wrong password in `backend/.env` | App/tests use credentials that don’t match the container |
| **Another** Postgres already bound to `:5432` | Compose never starts `transport-postgres`; clients hit the other instance |
| Docker volume created earlier with different env | Password is fixed at **first** volume init; later compose env changes are ignored |

### What we fixed in the repo

Integration tests derive `transport_abt_test` / `postgres` URLs from `DATABASE_URL` in `.env` (same user/password, different DB name). See `backend/src/tests/dbUrls.ts`.

Optional overrides in `.env`:

```text
TEST_DATABASE_URL=postgresql://transport_user:…@localhost:5432/transport_abt_test
ADMIN_DATABASE_URL=postgresql://transport_user:…@localhost:5432/postgres
```

### What to do

1. Align `backend/.env` with compose:

   ```text
   DATABASE_URL=postgresql://transport_user:your_password@localhost:5432/transport_abt
   ```

2. Ensure **this** project’s container owns `:5432` (next section).

3. If you intentionally changed the password after the volume existed, either:
   - put the **original** password back in `.env`, or
   - reset the volume (destroys local DB data):

   ```bash
   docker compose down
   docker volume rm transport_payment_postgres-data
   docker compose up -d postgres
   ```

---

## Port 5432 already allocated

### Symptom

```text
docker compose up -d postgres
Error: Bind for 0.0.0.0:5432 failed: port is already allocated
```

Container may stay in `Created` and never become healthy.

### Find the occupant

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker ps --filter publish=5432
```

### Real example from this machine

| Container | Role |
|-----------|------|
| `backend-postgres-1` | **Old** stack; was healthy and holding `0.0.0.0:5432` |
| `transport-postgres` | This repo’s compose service; failed to bind |

Volumes:

```text
backend_postgres_data              ← older setup
transport_payment_postgres-data    ← this repo (docker compose)
```

You only need **one** Postgres on `:5432` for this project — prefer `transport-postgres`.

### Fix

```bash
# Stop whatever owns 5432 (name may differ)
docker stop backend-postgres-1
# optional: docker rm backend-postgres-1

# Clean up a failed start
docker rm transport-postgres 2>/dev/null || true

# Start this project's DB
cd /path/to/transport_payment
docker compose up -d postgres
docker compose ps

# Migrate + seed + test
cd backend
npm run db:migrate
npm run db:seed
npm test
```

### Optional cleanup

```bash
docker rm backend-postgres-1
# only if you no longer need old data:
# docker volume rm backend_postgres_data
```

---

## Symptom: Vitest says “No test files found” + DB error

Integration config runs `globalSetup` first. If setup throws (connection/auth), Vitest often prints **“No test files found”** even though `src/tests/**/*.test.ts` exists. Treat the **Postgres error** as the real failure.

- Unit suite: `npm run test:unit` (no DB)
- Full suite: `npm test` (needs healthy Postgres)

---

## Symptom: Vite proxy / Bad Gateway on login

Frontend alone is not enough. Vite proxies `/api` → `http://localhost:3000`.

```text
[vite] http proxy error: /api/auth/login
ECONNREFUSED
```

**Fix:** run API + DB as well:

```bash
docker compose up -d postgres
cd backend && npm run db:migrate && npm run dev   # :3000
cd frontend && npm run dev                        # :5173
```

---

## Healthy local layout

```text
Docker:  transport-postgres  → localhost:5432
         DBs: transport_abt (app), transport_abt_test (Vitest)
API:     backend  npm run dev  → :3000
UI:      frontend npm run dev  → :5173  (proxy /api → :3000)
```

Compose defaults (`docker-compose.yml`):

```text
POSTGRES_USER=transport_user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=transportdb          # bootstrap DB; ABT DBs created by init script
```

Init script also creates `transport_abt` and `transport_abt_test` on **first** volume init (`docker/postgres/init-abt-db.sql`). If the volume already existed before that script was added, create DBs manually or reset the volume.

---

## Related docs

- [`README.md`](../README.md) — quick start
- [`backend/.env.example`](../backend/.env.example) — env vars
- [`docs/AWS_DEPLOYMENT_GUIDE.md`](AWS_DEPLOYMENT_GUIDE.md) — cloud Postgres (not local Docker)
