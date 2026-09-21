# Security Hardening Plan (post-v1)

**Duration estimate:** 5–8 days across three milestones  
**Depends on:** Phases 0–8 (ABT v1 complete)  
**Unlocks:** Portfolio-credible answers to ownership, device identity, and double-settlement  
**Source:** External review of `ts_payment_overhaul_v1.md` mapped onto the **current** codebase (not speculative plan-only gaps)

These are **recommendations → implementation work**, not confirmed production CVEs. Scope is defensive hardening inside existing Express services + Postgres constraints + Vitest/Supertest.

---

## 0. Current baseline (what you already have)

| Area | Already in place |
|------|------------------|
| Auth | JWT (`sub`, `accountId`) via `requireAuth` |
| Ownership on reads | `getForAccount` / `getFareForAccount` / ledger by `auth.accountId` |
| Rider category | Register always assigns `ADULT`; no customer PATCH |
| Tap media/account | Reject inactive media / suspended account / offline validator |
| Network truth | Station + ENTRY/EXIT derived from validator row |
| Settlement shared | `SettlementService` used by EXIT and expire job |
| Locks | Cap accumulator + wallet `FOR UPDATE`; expire locks journey |
| Journey rule | Partial unique index: one `OPEN` journey per account |
| Money domain | Integer pence helpers; DB `NUMERIC(10,2)` |
| Top-up bounds | Positive amount, max £100, requires JWT |

**Primary gaps this plan closes:** cross-user test proof, staff/admin auth, validator credentials + tap replay, EXIT journey lock + unique settlement constraints + concurrency tests. Ledger DB roles and correction flows are **follow-ons** (§5).

---

## 1. Why three milestones (order matters)

```text
S1 Ownership & roles     → stop IDOR / privilege confusion on APIs you already expose
S2 Authenticated taps    → stop fabricated gate events (biggest demo hole)
S3 Atomic settlement     → stop double fare / fare+penalty races
```

Do **not** start with Stripe webhooks or full RBAC CMS. The architecture’s sharp edges are account-scoped data, open `POST /api/taps`, and settle races.

---

## Milestone S1 — Account ownership & identity boundaries

**Estimate:** 1–2 days  
**Goal:** User A cannot read or affect User B’s journeys, fares, or ledger. Financial fields customers must not control stay closed. Demo/admin power is explicit.

### S1.1 — Prove ownership in services (not only routes)

Already true for journeys/fare; audit every authenticated path:

| Endpoint | Must resolve via |
|----------|------------------|
| `GET /account` | `auth.accountId` only |
| `GET /account/journeys` | `listForAccount(accountId)` |
| `GET /account/journeys/:id` | `getForAccount(accountId, id)` → 404 if other |
| `GET /account/journeys/:id/fare` | `getFareForAccount` → 404 if other |
| `GET /account/wallet/ledger` | wallet by `auth.accountId` |
| `GET /account/cap-status` | same |
| `POST /wallet/topup` | credit only `auth.accountId` |

**Rule:** never load a journey/fare/ledger by id alone then “check owner later.” Filter in the query.

Return **404** (not 403) for cross-account ids so you don’t leak existence.

### S1.2 — JWT claims hygiene

- Keep payload minimal: `sub` (userId), `accountId`, optional `role`.
- On each request, optionally re-check account still `ACTIVE` (middleware or service).
- Do not put `riderCategoryId` or balance in the token.

### S1.3 — Roles (minimal)

Introduce:

```text
role: 'CUSTOMER' | 'STAFF' | 'DEVICE'   // DEVICE used in S2
```

| Action | Who |
|--------|-----|
| Read own account / journeys / ledger / top-up (mock) | `CUSTOMER` |
| List stations for UI (optional) | `CUSTOMER` or public read-only catalog |
| `POST /admin/jobs/expire-journeys` | `STAFF` only |
| Change rider category / fare rules / manual adjust | `STAFF` only (no customer API) |

Seed one staff user for demos, e.g. `staff@example.com` / `password123` with `role=STAFF`.

Middleware:

```text
requireAuth → requireRole('STAFF') for admin job routes
```

### S1.4 — Keep dangerous fields closed

Confirm **no** routes for customers to:

- set `riderCategoryId`
- set `wallet.balance` / account `status`
- mutate fare rules

If you add profile update later, whitelist fields explicitly (Zod).

### S1.5 — Tests (acceptance for S1)

```text
backend/src/tests/ownership.integration.test.ts
```

| Case | Expect |
|------|--------|
| A JWT + B’s `journeyId` on detail/fare | 404, empty of B’s data |
| A JWT + ledger | only A’s entries |
| Customer JWT → `POST /admin/jobs/expire-journeys` | 401/403 |
| Staff JWT → expire job | 200 |
| Register body with `riderCategoryId: STUDENT` | ignored / rejected; account stays ADULT |

### S1 acceptance checklist

- [x] All customer money/travel reads scoped by `accountId` in the DB query
- [x] Admin expire job requires `STAFF`
- [x] Ownership integration tests green *(suite added; run with Postgres)*
- [x] No new customer endpoints that set rider category or balance

**Audit:** [`security_s1_audit.md`](security_s1_audit.md)

---

## Milestone S2 — Authenticated, replay-safe taps

**Estimate:** 2–3 days  
**Goal:** A tap request must prove **which validator** sent it; replays and cross-station spoofing fail.

### S2.1 — Split public simulator from “device” taps

| Route | Audience | Auth |
|-------|----------|------|
| `POST /api/demo/taps` | Browser Vite simulator | Customer JWT **or** dedicated demo secret + rate limit; **never** embed long-lived validator secrets in frontend |
| `POST /api/taps` | Simulated gate / future device | **Device credential** bound to one validator |

Deprecate anonymous `POST /api/taps` (breaking for old clients — update frontend in same PR).

**Demo path design (portfolio-friendly):**

- Authenticated customer posts `{ mediaToken?, validatorCode, timestamp }`
- Server verifies JWT, media belongs to **that** account (or uses their first ACTIVE media)
- Server still loads validator from DB; customer cannot invent a fake validator UUID
- Rate-limit per account (e.g. 30/min)

This keeps the UI usable without putting gate credentials in Vite.

**Device path (realism):**

- Header: `X-Validator-Key: <secret>` or `Authorization: Bearer <device-jwt>`
- Secret hashed at rest on `validators` (or side table `validator_credentials`)
- Resolve validator **only** from credential → ignore client-supplied station; reject if body `validatorId` disagrees

### S2.2 — Schema additions

```text
validators (or validator_credentials)
  credential_hash   text
  credential_prefix text     -- for lookup without timing-leaking full scan
  revoked_at        timestamptz null

tap_events
  device_event_id   varchar  null for legacy; required for DEVICE path
  UNIQUE (validator_id, device_event_id)  WHERE device_event_id IS NOT NULL
```

Seed demo credentials **only into backend env / seed output logs**, not `frontend/`.

### S2.3 — TapService hardening

On every tap (demo + device):

1. Resolve validator (credential **or** validated code for demo)
2. Media ACTIVE; account ACTIVE
3. Derive `tapType` + `stationId` from validator row (already done)
4. **Timestamp policy** (config):
   - reject if `eventTime` > now + 2 minutes
   - reject if `eventTime` < now − 24 hours (or journey max duration window)
5. Insert tap with `device_event_id`; unique violation → **200/409 idempotent replay** (return prior result or `TAP_REPLAY`)

### S2.4 — Frontend

- Point tap page at `POST /api/demo/taps` with customer JWT
- Prefill media from account; dropdown still uses `/admin/stations` **or** move catalog to `GET /api/network/stations` (customer-readable, no secrets)

### S2.5 — Tests (acceptance for S2)

| Case | Expect |
|------|--------|
| Device key for Central ENTRY cannot post as Riverside validator | 401/403 |
| Same `(validatorId, deviceEventId)` twice | no second journey/charge |
| Blocked media / suspended account | 403 |
| Timestamp 1 week in the past | 400 |
| Demo tap without JWT | 401 |
| Demo tap with JWT but media token of another user | 403 |

### S2 acceptance checklist

- [ ] Anonymous `POST /api/taps` removed or device-auth only
- [ ] Browser uses `/api/demo/taps` + JWT; no validator secrets in frontend
- [ ] Replay unique constraint enforced
- [ ] Cross-validator credential test green

---

## Milestone S3 — Atomic settlement (EXIT ∪ expire)

**Estimate:** 2–3 days  
**Goal:** Exactly one initial settlement outcome per journey under concurrency.

### S3.1 — Lock journey on EXIT (match expire)

In `JourneyService.applyTap` EXIT path:

```text
SELECT … FROM journeys WHERE id = open.id FOR UPDATE
recheck status === 'OPEN'
then COMPLETE + settle in same tx
```

Same lock order everywhere:

```text
1. journey (FOR UPDATE)
2. fare accumulator (FOR UPDATE)   -- CapService.lockHeadroom
3. fare charge / wallet (FOR UPDATE)
```

Document lock order in `SettlementService` comment (already partially there).

### S3.2 — Database uniqueness: one initial settlement

```text
UNIQUE (fare_calculations.journey_id)           -- or unique where version = 1
UNIQUE (fare_charges.journey_id)                -- for v1 single charge
-- later: allow corrections via version / parent_charge_id, not a second “initial”
```

In `FareService.priceJourney`:

- Keep “return existing calc/charge” path
- On unique violation, re-select and return existing (idempotent under race)

Optional: unique on ledger `(reference_type, reference_id)` where type = `FARE` so a charge cannot debit twice.

### S3.3 — Settle only after journey transition succeeds

Ensure settle sees journey status `COMPLETED` or `INCOMPLETE_*` inside the same transaction after the status update (already true for expire; verify EXIT).

### S3.4 — Tests (acceptance for S3)

```text
backend/src/tests/settlementConcurrency.integration.test.ts
```

| Case | Expect |
|------|--------|
| Two parallel EXIT taps (same open journey) | one COMPLETED journey; one fare charge; one FARE ledger debit |
| EXIT racing `expireOpenJourneys` | one terminal status; either normal fare **or** penalty, never both |
| Re-call settle / re-price same journey | no second debit |
| Insufficient balance on EXIT | Policy A: whole EXIT rolls back (existing); assert no orphan charge |

Use `Promise.all` + Supertest or direct service calls against `transport_abt_test`.

### S3 acceptance checklist

- [ ] EXIT uses `FOR UPDATE` on journey
- [ ] Unique constraints on calc/charge per journey
- [ ] Concurrency tests green
- [ ] Expire + EXIT cannot produce fare + penalty

---

## 2. Suggested file / change map

| Location | S1 | S2 | S3 |
|----------|----|----|----|
| `middleware/auth.ts` | roles | device auth helper | |
| `routes/admin.ts` | `requireRole('STAFF')` | | |
| `routes/tap.ts` | | split demo vs device | |
| `routes/demoTap.ts` (new) | | customer JWT taps | |
| `TapService.ts` | | credential, replay, time policy | |
| `JourneyService.ts` | | | EXIT `FOR UPDATE` |
| `FareService.ts` / `SettlementService.ts` | | | unique + idempotent insert |
| `db/schema.ts` + migration | users.role | credential + device_event_id | unique journey settlement |
| `frontend` tap page | | `/api/demo/taps` | |
| `src/tests/*.integration.test.ts` | ownership | taps security | concurrency |

---

## 3. Out of scope for S1–S3 (follow later)

Do not block S1–S3 on these:

| Item | Note |
|------|------|
| Restricted Postgres role (no UPDATE/DELETE on ledger) | Ops/migration split; document in AWS guide |
| Balance ↔ ledger reconciliation job | Nightly check / admin report |
| Journey correction + approved refunds | New product flow; append-only refund entries |
| Stripe webhooks | Replace mock top-up when ready; then disable mock in prod |
| Idempotent top-up keys | Quick win after S3 (`Idempotency-Key` header) |
| WAF / global rate limits | Deploy-time |
| Full staff CMS for fare rules | Manual seed/SQL enough for portfolio |

### Optional Milestone S4 (short) — Top-up & ledger hygiene

If time remains after S3:

1. `Idempotency-Key` on `POST /wallet/topup` → unique payment `provider_reference`
2. `ALLOW_MOCK_TOPUP=true` only when `NODE_ENV !== 'production'` (or explicit flag)
3. Unique index on `(reference_type, reference_id)` for FARE ledger lines
4. One reconciliation helper + test with intentional mismatch

---

## 4. Implementation order (day-by-day sketch)

| Day | Work |
|-----|------|
| 1 | S1 roles + lock admin expire + ownership tests |
| 2 | S2 schema credentials + device auth on `/api/taps` |
| 3 | S2 demo route + frontend switch + replay/time tests |
| 4 | S3 journey lock on EXIT + unique constraints |
| 5 | S3 concurrency tests; fix races until green |
| 6 | Buffer / S4 top-up idempotency; update README + audit md |

---

## 5. Definition of done (security slice)

A milestone is done only when its **acceptance checklist** and **named tests** pass — not when files exist.

Cross-cutting:

- [ ] `npm run test:unit` still green  
- [ ] `npm run test:integration` includes new security suites  
- [ ] README notes demo tap auth + staff expire  
- [ ] `docs/API.md` updated for new/changed routes and error codes  
- [ ] Write `execution_plans/security_s1_audit.md` (etc.) when each milestone ships  

---

## 6. Error codes to add (stable for UI)

| Code | When |
|------|------|
| `FORBIDDEN` | Authenticated but wrong role |
| `VALIDATOR_AUTH_FAILED` | Bad/revoked device credential |
| `TAP_REPLAY` | Duplicate `device_event_id` |
| `TIMESTAMP_OUT_OF_RANGE` | Event time policy |
| `MEDIA_NOT_OWNED` | Demo tap using another account’s token |

Prefer 404 for cross-account resource access (`JOURNEY_NOT_FOUND`).

---

## 7. Handoff notes

- Keep financial writes in **one Postgres transaction**; do not move settle to SQS for this work.  
- Device credentials are for the **portfolio security story**; the browser keeps using the **demo** path.  
- After S3, you can honestly say: ownership enforced, taps authenticated or demo-scoped, settlement race-tested.

**Next action when implementing:** start Milestone S1 (smallest diff, immediate IDOR proof).
