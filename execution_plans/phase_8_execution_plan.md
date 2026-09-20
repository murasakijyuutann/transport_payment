# Phase 8 — Polish & Tests

**Duration estimate:** 2–3 days  
**Depends on:** Phases 0–7 functionally complete  
**Unlocks:** portfolio-ready repo  
**Deliverable:** README with architecture, seed demo dataset, unit + integration tests, strict TS, env documented.

---

## 1. Why this phase exists

Phases 0–7 build the system; Phase 8 makes it **explainable and trustworthy**. Interviewers and GitHub visitors need:

1. How to run it in &lt;10 minutes  
2. Why the domain is split the way it is  
3. Proof fare rules and tap→ledger flow work without clicking the UI  

---

## 2. Ordered work checklist

### Step 8.1 — README (root or `backend/` + root)

Must include:

- One-paragraph product summary (ABT prepaid transit)
- Architecture diagram (mermaid OK) — TapEvent → Journey → FareCalculation → FareCharge → Ledger
- Entity list vs old Java model
- Run instructions:
  - `docker compose up -d`
  - create `transport_abt` if needed
  - `backend` migrate + seed + `npm run dev`
  - `frontend` `npm run dev`
- Demo credentials + sample tap sequence
- Link to [`ts_payment_overhaul_v1.md`](../ts_payment_overhaul_v1.md) and [`execution_plans/`](./)

Update or replace outdated Java-centric root `README.md` with a short “Legacy Spring prototype” note pointing at `src/`, and make the TS app the primary instructions.

### Step 8.2 — Rich seed / demo scenario

Extend `seed.ts` to optionally run `seedDemoStory()`:

```text
User: student@example.com
Wallet: £20 after top-up ledger
Media: CARD-STUDENT-001
Journeys:
  - 2 completed trips (zone 1→2)
  - accumulator partially filled
  - 1 OPEN journey started 5h ago (for expire demo) OR pre-expired incomplete
```

Document in README.

### Step 8.3 — API documentation

Lightweight options (pick one):

- `docs/API.md` — table of routes, bodies, error codes
- Or JSDoc on routers + short markdown

Include stable error codes used by UI:

```text
JOURNEY_ALREADY_OPEN
NO_OPEN_JOURNEY
INSUFFICIENT_BALANCE
MEDIA_BLOCKED
```

### Step 8.4 — Unit tests (Vitest) — FareEngine

```text
backend/src/domain/fare/__tests__/
  ZoneRule.test.ts
  RiderCategoryRule.test.ts
  IncompleteJourneyRule.test.ts
  CapRule.test.ts
  FareEngine.test.ts
```

No DB. Cover student discount math, penalty replace behavior, cap headroom trim, rule order.

### Step 8.5 — Integration test (Supertest)

```text
backend/src/tests/tapJourneyLedger.integration.test.ts
```

Flow:

```text
register → topUp → tap ENTRY → tap EXIT → get fare → get ledger → assert balance
```

Use a test database (`transport_abt_test`) or transactions with rollback. Prefer dedicated test DB + migrate in `globalSetup`.

Also test:

- double ENTRY → 409
- expireOpenJourneys with backdated `startedAt`

### Step 8.6 — Tooling polish

- [ ] `strict` TS on backend + frontend
- [ ] `.env.example` complete
- [ ] `npm test` script
- [ ] Optional: GitHub Actions CI (install, migrate test DB, vitest) — nice-to-have
- [ ] Ensure `target/` and Java build artifacts stay gitignored; do not commit compiled classes

### Step 8.7 — Consistency pass

- All money through pence helpers
- All timestamps timestamptz / ISO strings in API
- No second wallet update path outside `WalletService`
- Cron not started in test `createApp()`

### Step 8.8 — Explicit non-goals checklist (README)

List deferred items from overhaul doc “Phase 2” future:

- Open-loop bank cards
- Weekly capping / peak fares
- Journey correction + refund
- Stripe
- Debt recovery

This frames v1 as intentional scope, not incomplete work.

---

## 3. Suggested test commands

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run src/tests"
  }
}
```

---

## 4. Reasoning: test pyramid for this project

| Layer | What | Why |
|-------|------|-----|
| Unit | Fare rules | Highest regression value; pure money logic |
| Integration | tap→ledger | Proves wiring + SQL constraints |
| E2E browser | skip or minimal | Expensive; Phase 7 manual demo script suffices for v1 |

Do not aim for 100% coverage of Express glue.

---

## 5. Acceptance criteria

- [x] Fresh clone: follow README → health OK → demo trip works
- [x] `npm test` green (unit + at least one integration flow)
- [x] Architecture explained without reading 1600-line design doc
- [x] Seed produces a convincing demo state
- [x] Legacy Java mentioned as reference only
- [x] No secrets in git

**Audit:** [`phase_8_audit.md`](phase_8_audit.md)

## 6. After Phase 8

Optional follow-ons (new phases, not part of this plan):

- Journey correction + refund ledger
- OpenAPI/Swagger UI
- Weekly cap
- Replace mock top-up with Stripe test mode

---

## 7. Cross-phase definition of done (reminder)

A phase is done only when its **acceptance criteria** are met, not when files exist. Prefer vertical slices (working API) over unfinished abstractions.
