# Security S1 Audit — Ownership & roles

**Date:** 2026-09-21  
**Plan:** [`security_hardening_plan.md`](security_hardening_plan.md) § Milestone S1  
**Outcome:** S1 implemented in code; unit tests green. Integration ownership suite ready — run after Postgres is up + migrate.

---

## 1. What shipped

| Change | Detail |
|--------|--------|
| `users.role` | Enum `CUSTOMER` \| `STAFF` \| `DEVICE`; migration `0005_user_role.sql` |
| JWT | Claims `sub`, `accountId`, `role`; role refreshed from DB each request |
| `requireAuth` | Rejects inactive user/account; ensures account belongs to user |
| `requireRole(...)` | Used for STAFF-only routes |
| Register | `.strict()` body; always `CUSTOMER` + `ADULT` rider |
| Admin expire | `POST /admin/jobs/expire-journeys` requires JWT + `STAFF` |
| Seed | `staff@example.com` / `password123` |
| Frontend | Wallet ops panel only for `role === 'STAFF'` |
| Tests | `src/tests/ownership.integration.test.ts` |

---

## 2. Acceptance checklist

| Criterion | Status |
|-----------|--------|
| Customer money/travel reads scoped by `accountId` | **Met** (pre-existing + documented) |
| Admin expire requires `STAFF` | **Met** |
| Ownership integration tests | **Added** — need `npm test` with Docker/Postgres |
| No customer APIs for rider category / balance | **Met** |

---

## 3. Verify locally

```bash
# Docker Desktop on
docker compose up -d postgres
cd backend
npm run db:migrate
# also migrate test DB (globalSetup usually does this on npm test)
npm run db:seed
npm test
```

Demo staff: `staff@example.com` / `password123`.

---

## 4. Handoff to S2

Next: authenticated / replay-safe taps (`security_hardening_plan.md` Milestone S2).
