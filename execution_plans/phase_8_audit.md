# Phase 8 Audit — Polish & Tests

**Date:** 2026-09-20  
**Plan:** [`phase_8_execution_plan.md`](phase_8_execution_plan.md)  
**Outcome:** Phase 8 accepted — portfolio-ready README, API docs, seed story, unit + integration tests green.

---

## 1. Summary

- Root README rewritten for the TS/ABT stack (quick start, architecture mermaid, demo credentials, non-goals, legacy note)
- [`docs/API.md`](../docs/API.md) — routes + stable error codes
- Seed: `seedCore` + `seedDemoStory` (2 completed student trips + 5h-old OPEN journey)
- Vitest unit tests for fare rules + money; Supertest tap→ledger + double ENTRY + expire
- Test DB `transport_abt_test` (init SQL + globalSetup create/migrate)
- Optional GitHub Actions [`backend-ci.yml`](../.github/workflows/backend-ci.yml)
- `.env.example` documents test DB overrides

---

## 2. Verification

| Check | Result |
|-------|--------|
| `cd backend && npm test` | **23 passed** (7 files) |
| Unit: Zone / Rider / Incomplete / Cap / FareEngine / money | **Pass** |
| Integration: round trip + ledger balance £16 | **Pass** |
| Integration: `JOURNEY_ALREADY_OPEN` on double ENTRY | **Pass** |
| Integration: expire backdated OPEN → £5 penalty | **Pass** |
| `tsc --noEmit` backend + frontend | **Pass** |
| Cron not started via `createApp()` | **Met** (job only in `server.ts`) |

---

## 3. Acceptance criteria scorecard

| Criterion | Status |
|-----------|--------|
| Fresh clone README → health / demo | **Met** (documented) |
| `npm test` green (unit + integration) | **Met** |
| Architecture without reading full design doc | **Met** |
| Seed produces convincing demo state | **Met** |
| Legacy Java reference-only | **Met** |
| No secrets in git | **Met** (`.env` gitignored; `.env.example` only) |

---

## 4. Demo reminders

| User | Password | Media |
|------|----------|-------|
| `demo@example.com` | `password123` | `CARD-DEMO-001` |
| `student@example.com` | `password123` | `CARD-STUDENT-001` |

Student seed: discounted completed trips + OPEN journey for expire button / `POST /api/admin/jobs/expire-journeys`.

---

## 5. Optional follow-ons (not Phase 8)

- Journey correction + refund ledger
- OpenAPI / Swagger UI
- Weekly cap
- Stripe test-mode top-up
