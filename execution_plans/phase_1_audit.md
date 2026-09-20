# Phase 1 Audit — Account + Network Data

**Date:** 2026-09-20  
**Plan:** [`phase_1_execution_plan.md`](phase_1_execution_plan.md)  
**Outcome:** Phase 1 accepted — register → login → top-up → account + 6 stations seeded.

---

## 1. Summary

Built the ABT data foundation on `transport_abt`:

- Drizzle schema for users, transit accounts, fare media, wallets, rider categories, zones, stations, validators, payment transactions
- Migration `0000_curious_fixer.sql` applied
- Seed: ADULT/STUDENT, 2 zones, 6 stations, 12 validators, demo user
- JWT auth (register/login), account view, mock wallet top-up, admin stations list
- Phase 2 helpers: `findMediaByToken`, `findValidatorByCode`

---

## 2. What was created / changed

### Schema & DB

| Item | Detail |
|------|--------|
| [`backend/src/db/schema.ts`](../backend/src/db/schema.ts) | Full Phase 1 table set + enums |
| [`backend/src/db/migrations/0000_curious_fixer.sql`](../backend/src/db/migrations/0000_curious_fixer.sql) | Generated migration |
| [`backend/src/db/seed.ts`](../backend/src/db/seed.ts) | Idempotent seed script |
| `transport_abt` | Created on project Postgres (`transport-postgres`) |

### Services & routes

| Path | Role |
|------|------|
| `services/AuthService.ts` | Register (user+account+wallet+media), login, JWT |
| `services/AccountService.ts` | `AccountView`, list stations, media/validator lookups |
| `services/WalletService.ts` | Mock top-up + `payment_transactions` row |
| `routes/auth.ts` | `POST /api/auth/register`, `POST /api/auth/login` |
| `routes/account.ts` | `GET /api/account` |
| `routes/wallet.ts` | `POST /api/wallet/topup` |
| `routes/admin.ts` | `GET /api/admin/stations` (public) |
| `middleware/auth.ts` | `requireAuth`, `signToken` |

### Dependencies added

- `bcryptjs`, `jsonwebtoken` (+ types)
- npm script `db:seed`

### Ops note

Port 5432 was occupied by container `backend-postgres-1`. It was stopped so `transport-postgres` from this project's `docker-compose.yml` could bind 5432. Restart that other container later if you still need it.

---

## 3. Seed data

| Kind | Values |
|------|--------|
| Rider categories | ADULT 0%, STUDENT 50% |
| Zones | `1` Zone 1, `2` Zone 2 |
| Stations | CENTRAL, CITYHALL, MUSEUM / RIVERSIDE, AIRPORT_EAST, GREEN_PARK |
| Validators | Per station: `VAL-{CODE}-ENTRY-01`, `VAL-{CODE}-EXIT-01` |
| Demo user | `demo@example.com` / `password123` · token `CARD-DEMO-001` · wallet £20.00 |

---

## 4. Verification

| Check | Result |
|-------|--------|
| `npm run db:migrate` | Applied successfully |
| `npm run db:seed` | Completed |
| `GET /api/admin/stations` | 6 stations, 12 validators |
| `POST /api/auth/register` | 201 + JWT + media token + £0 wallet |
| Duplicate email | 409 `EMAIL_TAKEN` |
| `GET /api/account` (Bearer) | Balance + media |
| `POST /api/wallet/topup` `{ amount: 15 }` | Balance → `15.00` |
| Demo login | JWT + £20 account |
| `npx tsc --noEmit` | Pass |

---

## 5. Acceptance criteria scorecard

| Criterion | Status |
|-----------|--------|
| Migrations apply on empty `transport_abt` | **Met** |
| Seed creates zones, stations, validators, rider categories | **Met** |
| Register creates user + account + wallet + media | **Met** |
| Login returns JWT | **Met** |
| `GET /api/account` returns balance and token | **Met** |
| Top-up increases balance | **Met** |
| `GET /api/admin/stations` returns 6 stations with zones | **Met** |
| Duplicate email → 409 | **Met** |

---

## 6. Decisions

1. **bcryptjs** (not argon2) — simple, portable for portfolio v1.
2. **JWT payload** `{ sub: userId, accountId }` — avoids extra lookup on every account call.
3. **Default rider ADULT** on register; STUDENT available via seed only for now.
4. **Stations endpoint public** — tap simulator in Phase 2/7 does not need JWT for network lists.
5. **Top-up without ledger** — Phase 4 will add `wallet_ledger_entries`; Phase 1 writes `payment_transactions` + balance only.
6. **Max top-up £100** — validation guard.

---

## 7. Not in this phase (by design)

- Tap events / journeys
- Fare rules / charges
- Wallet ledger
- Frontend account pages

---

## 8. Handoff to Phase 2

Ready to use:

- `findMediaByToken(token)`
- `findValidatorByCode(code)` — ENTRY/EXIT gates seeded
- Auth + account status checks via existing tables

Next: [`phase_2_execution_plan.md`](phase_2_execution_plan.md) — `POST /api/taps`, TapEvent → Journey.
