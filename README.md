# Transport Payment System

Account-based public transport tap-on / tap-off payments — currently being redesigned.

## Status: overhaul in progress

This repository holds a working **Spring Boot prototype** and a planned **TypeScript rewrite** into a more realistic Account-Based Ticketing (ABT) system.

| Layer | State |
|-------|--------|
| Legacy prototype | Spring Boot + JPA under `src/` — behavioral reference |
| Target system | Node.js / Express / TypeScript + Drizzle + Vite — Phase 7 (frontend dashboard) done |
| Design | [`ts_payment_overhaul_v1.md`](ts_payment_overhaul_v1.md) |
| Build plan | [`execution_plans/`](execution_plans/) |

The Java app remains runnable for reference. New work follows the phase plans; do not extend the Spring domain model as the long-term architecture.

---

## What this project is about

Model a prepaid transit payment backend closer to how real systems separate concerns:

- A physical card or device is only an identifier (**fare media**), not the source of truth for balance or journeys.
- Travel identity lives on a **transit account** (with rider category and wallet).
- Gate activity is stored as **tap events**; a **journey** is an interpretation of those events.
- Pricing is a dedicated **fare engine** with an auditable **fare calculation**.
- Money owed is a **fare charge**; stored value changes via an append-only **wallet ledger**.
- External money movement (e.g. mock top-up) is a **payment transaction**, separate from fare.

Each stage answers a different question:

```text
TapEvent          → What physically happened?
Journey           → What trip did those events represent?
FareCalculation   → What should this trip cost, and why?
FareCharge        → What does the passenger owe?
WalletLedgerEntry → How did stored value change?
PaymentTransaction→ What external money moved?
```

---

## Objective

Deliver a portfolio-ready ABT demo that can:

1. Register a passenger, issue transit-card media, and top up a prepaid wallet.
2. Accept tap-in / tap-out against validators and stations, producing journeys.
3. Price completed trips with zone rules, rider discounts, and a stored fare breakdown.
4. Debit the wallet atomically with a full ledger history.
5. Enforce a daily fare cap.
6. Auto-penalise journeys left open past a time limit (scheduled job).
7. Expose a simple browser dashboard for the full flow end-to-end.

**Primary milestone:** Phase 2 — tap & journey core (events → open/completed journeys) before fare and wallet layers.

**Out of v1 scope:** open-loop bank cards, Stripe, weekly/peak fares, journey correction/refunds, debt recovery.

---

## Target stack

```text
Backend:   Node.js + Express + TypeScript, Drizzle ORM, PostgreSQL, node-cron
Frontend:  Vite (vanilla TypeScript), native fetch
Testing:   Vitest (unit) + Supertest (integration)
```

Target layout (from the overhaul doc):

```text
backend/     # Express API, domain, jobs, Drizzle
frontend/    # Vite dashboard
src/         # Legacy Spring Boot prototype (reference only)
execution_plans/   # Phase-by-phase implementation guides
```

---

## Build phases

| Phase | Focus | Detail |
|-------|--------|--------|
| 0 | Setup & skeleton | Health check, Drizzle, Vite proxy — **done** |
| 1 | Account + network | User, transit account, fare media, wallet, zones/stations/validators — **done** |
| 2 | Tap & journey core | `POST /api/taps`, TapEvent → Journey — **done (primary milestone)** |
| 3 | Fare engine | Zone / rider / incomplete rules, FareCalculation + FareCharge — **done** |
| 4 | Wallet & ledger | Atomic debit, append-only ledger — **done** |
| 5 | Daily cap | Accumulators, CapRule, £15 day cap — **done** |
| 6 | Incomplete job | Cron expiry after 4 hours + penalty — **done** |
| 7 | Frontend dashboard | Login, tap simulator, journeys, ledger — **done** |
| 8 | Polish & tests | README for the new stack, seed story, Vitest/Supertest |

### Running Phase 0–7 (current)

```bash
docker compose up -d postgres
cd backend && npm install && npm run db:migrate && npm run db:seed && npm run dev
# Cron expires OPEN journeys after 4h; demo: POST /api/admin/jobs/expire-journeys

cd frontend && npm install && npm run dev
# http://localhost:5173 — proxy /api → :3000
# Demo: demo@example.com / password123
```

Start next: [`execution_plans/phase_8_execution_plan.md`](execution_plans/phase_8_execution_plan.md).

Full phase index: [`execution_plans/README.md`](execution_plans/README.md).

---

## Domain shift (prototype → target)

| Prototype (Java) | Target (ABT) |
|------------------|--------------|
| Balance on `User` | `Wallet` on `TransitAccount` |
| Payment-style `Card` | `FareMedia` (transit token) |
| Zone embedded on `Station` | `Zone` → `Station` → `Validator` |
| Journey holds fare fields | `FareCalculation` + `FareCharge` |
| Single `Transaction` type | Ledger + payment + charge separated |
| Incomplete handling ad hoc | Scheduled job + incomplete fare rule |

---

## Legacy Spring prototype (reference)

Still useful for fare numbers and UI flow ideas. Not the destination architecture.

- **Stack:** Spring Boot 3.4, Java 21, PostgreSQL, Flyway, JWT, static HTML/JS
- **Run:** `docker compose up -d` then `mvn spring-boot:run` (app port typically `8083` — see `application.yml`)
- **Fare config (same numbers carried into the overhaul):** base £2.50, per-zone £1.50, daily cap £15, incomplete penalty £5, max journey 4 hours
- **API notes:** [`API_PORTFOLIO.md`](API_PORTFOLIO.md) · UI notes: [`WEBSITE_README.md`](WEBSITE_README.md)

---

## Documents

| Document | Role |
|----------|------|
| [`ts_payment_overhaul_v1.md`](ts_payment_overhaul_v1.md) | Full ABT design and information flows |
| [`execution_plans/`](execution_plans/) | Ordered implementation plans with scaffolding and acceptance criteria |
| [`API_PORTFOLIO.md`](API_PORTFOLIO.md) | Legacy Spring API overview |
| [`WEBSITE_README.md`](WEBSITE_README.md) | Legacy static frontend notes |
