# Transport Payment System (TransitPay)

Prepaid **Account-Based Ticketing (ABT)** for public transport: tap on / tap off, fare engine, wallet ledger, daily cap, and incomplete-journey expiry — with a thin Vite dashboard for demos.

The Node/TypeScript stack under `backend/` + `frontend/` is the product. The Spring Boot app under `src/` is a **behavioral reference only**.

---

## Quick start (<10 minutes)

```bash
# 1. Postgres (creates transport_abt + transport_abt_test on first volume init)
docker compose up -d postgres

# 2. API
cd backend
cp .env.example .env   # if needed
npm install
npm run db:migrate
npm run db:seed
npm run dev            # :3000

# 3. Dashboard
cd ../frontend
npm install
npm run dev            # :5173 — proxies /api → :3000
```

Open http://localhost:5173 — sign in with a demo user below.

**Tests:** `cd backend && npm test` (unit + integration against `transport_abt_test`).

---

## Demo credentials

| Email | Password | Media | Notes |
|-------|----------|-------|-------|
| `demo@example.com` | `password123` | `CARD-DEMO-001` | Adult, £20 wallet |
| `student@example.com` | `password123` | `CARD-STUDENT-001` | 50% discount; seed story below |

**Student seed story** (after `npm run db:seed`):

- £20 via top-up ledger
- 2 completed Zone 1→2 trips (discounted)
- 1 OPEN journey started ~5h ago → Wallet page “Run expire job” or `POST /api/admin/jobs/expire-journeys`

**Sample trip (adult):**

1. Tap ENTRY `VAL-CENTRAL-ENTRY-01`
2. Tap EXIT `VAL-RIVERSIDE-EXIT-01`
3. Fare £4.00; ledger shows FARE debit

---

## Architecture

```mermaid
flowchart LR
  TapEvent --> Journey
  Journey --> FareCalculation
  FareCalculation --> FareCharge
  FareCharge --> WalletLedgerEntry
```

| Stage | Question |
|-------|----------|
| TapEvent | What physically happened at a validator? |
| Journey | What trip did those taps represent? |
| FareCalculation | What should it cost, and why? |
| FareCharge | What does the passenger owe? |
| WalletLedgerEntry | How did stored value change? |
| PaymentTransaction | What external money moved (e.g. mock top-up)? |

```text
backend/     Express + Drizzle + Postgres (transport_abt)
frontend/    Vite vanilla TS multi-page dashboard
src/         Legacy Spring Boot prototype (reference)
docs/API.md  Route + error-code cheat sheet
execution_plans/  Phased build + audits
```

---

## Domain shift (Java prototype → ABT)

| Prototype (Java) | Target (ABT) |
|------------------|--------------|
| Balance on `User` | `Wallet` on `TransitAccount` |
| Payment-style `Card` | `FareMedia` (token) |
| Zone on `Station` | `Zone` → `Station` → `Validator` |
| Fare fields on journey | `FareCalculation` + `FareCharge` |
| Single `Transaction` | Ledger + payment + charge |
| Ad hoc incomplete | Cron + incomplete fare rule |

**Fare numbers (v1):** base/zone pairs £2.50 same-zone / £4.00 cross-zone, daily cap £15, incomplete penalty £5, max journey 4 hours.

---

## Build phases

| Phase | Focus | Status |
|-------|--------|--------|
| 0–6 | Backend ABT (account → taps → fare → wallet → cap → expire job) | **done** |
| 7 | Frontend dashboard | **done** |
| 8 | README, seed story, Vitest/Supertest, API docs | **done** |

Plans & audits: [`execution_plans/`](execution_plans/). Design: [`ts_payment_overhaul_v1.md`](ts_payment_overhaul_v1.md).

---

## Out of v1 scope

Intentional deferrals (not unfinished work):

- Open-loop bank cards
- Weekly capping / peak fares
- Journey correction + refunds
- Stripe (top-up is mock)
- Debt recovery

---

## Legacy Spring prototype

Still useful for historical fare UI ideas. Not the destination architecture.

- Stack: Spring Boot 3.4, Java 21, Flyway, JWT, static HTML
- Run: `docker compose up -d` then `mvn spring-boot:run` (see `application.yml`; often `:8083`)
- Notes: [`API_PORTFOLIO.md`](API_PORTFOLIO.md), [`WEBSITE_README.md`](WEBSITE_README.md)

---

## Documents

| Document | Role |
|----------|------|
| [`docs/API.md`](docs/API.md) | TS API routes & error codes |
| [`ts_payment_overhaul_v1.md`](ts_payment_overhaul_v1.md) | Full ABT design |
| [`execution_plans/`](execution_plans/) | Phase plans + audits |
