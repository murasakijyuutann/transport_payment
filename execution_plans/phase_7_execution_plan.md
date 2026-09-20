# Phase 7 — Frontend Dashboard

**Duration estimate:** 3–4 days  
**Depends on:** Phases 1–4 minimum; Phase 5–6 for full demo polish  
**Unlocks:** browser-only portfolio walkthrough  
**Deliverable:** register/login, top up, simulate taps, see journeys + fare breakdown + ledger + cap status without Postman.

---

## 1. Why this phase exists

Backend ABT design is hard to show in interviews without a thin UI. Keep the frontend **vanilla Vite + TypeScript** (doc §28) — no React — so the portfolio emphasizes domain modeling over SPA churn.

Reuse **flows** from the existing Java static site (`src/main/resources/static/`), not its Bootstrap structure or card-as-payment-card mental model.

---

## 2. Ordered work checklist

### Step 7.1 — App shell & routing

Vanilla TS options:

| Approach | Recommendation |
|----------|----------------|
| Multi-page HTML (`login.html`, `dashboard.html`, …) | Simple, matches old static site |
| Single `index.html` + hash routes | Slightly cleaner shared nav |

**Recommendation:** multi-page HTML under `frontend/` (Vite MPA) or separate HTML entries — fastest to ship.

```text
frontend/
├── index.html              # login
├── register.html
├── dashboard.html
├── tap.html                # simulate validator tap
├── journeys.html
├── journey.html            # detail + fare (?id=)
├── wallet.html             # ledger + top-up
├── src/
│   ├── api.ts
│   ├── auth.ts             # token in localStorage
│   ├── types.ts
│   └── pages/
│       ├── login.ts
│       ├── register.ts
│       ├── dashboard.ts
│       ├── tap.ts
│       ├── journeys.ts
│       ├── journeyDetail.ts
│       └── wallet.ts
```

### Step 7.2 — Typed API module

All network I/O in `api.ts` only:

```typescript
const BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function login(email: string, password: string) { /* ... */ }
export async function register(...) { /* ... */ }
export async function getAccount(): Promise<AccountView> { /* ... */ }
export async function topUp(amount: number) { /* ... */ }
export async function postTap(mediaToken: string, validatorId: string) { /* ... */ }
export async function listJourneys(): Promise<JourneyView[]> { /* ... */ }
export async function getJourneyFare(id: string) { /* ... */ }
export async function getLedger() { /* ... */ }
export async function getCapStatus() { /* ... */ }
export async function listStations() { /* ... */ }
```

**Why one module:** Phase 8 can swap base URL / mock easily; pages stay dumb.

### Step 7.3 — Auth UX

- On login success store JWT; redirect dashboard
- `auth.ts` `requireAuth()` redirect to login if missing/401
- Logout clears token

### Step 7.4 — Dashboard page

Single purpose: show account snapshot.

- Balance + currency
- Rider category
- Linked media token(s) (copyable)
- Cap headroom (if Phase 5 done)
- Links to Tap / Journeys / Wallet

Avoid stuffing tap forms and full ledger on the first screen (keep sections focused).

### Step 7.5 — Simulate tap page

Form fields:

- `mediaToken` (prefill from account)
- `validatorId` — **dropdown of validators** from stations API (show station name + ENTRY/EXIT), not free-text only

On submit call `postTap`; show JSON result (journey status) in a simple status region.

**Why dropdown:** prevents typos that look like backend bugs in demos.

### Step 7.6 — Journey list + detail

List: status, origin, destination, startedAt, final fare if available.

Detail: fare breakdown table:

```text
Base / Zone / Discount / Cap adjustment / Penalty / Final
```

Status badge for `OPEN` / `COMPLETED` / `INCOMPLETE_ENTRY`.

### Step 7.7 — Wallet page

- Current balance
- Top-up form (fixed chips: £10 / £20 / £50 + custom)
- Ledger table: time, type, amount, balanceAfter

### Step 7.8 — Visual direction

Existing user rules for frontend design apply if you restyle. For portfolio speed, a clean minimal stylesheet is enough — **do not** spend Phase 7 on complex motion. Prefer clarity of the ABT flow over marketing aesthetics.

If restyling: one cohesive composition, clear brand for the product name (e.g. “TransitPay”), avoid purple-gradient AI defaults.

---

## 3. Reasoning: why not port Bootstrap JS as-is

Old UI talks to Spring endpoints (`/api/users/...`, card CRUD, user balance). New API is account-centric (`/api/account`, `/api/taps`). A rewrite of `api.ts` + pages is cheaper than patching old `js/*.js` against a new contract.

---

## 4. Demo script (acceptance walkthrough)

1. Register new user (or login demo)
2. Top up £20
3. Tap ENTRY at Central
4. Tap EXIT at Riverside
5. Open journey detail → see zone fare + discount if student
6. Wallet ledger shows FARE debit
7. Repeat trips until cap trims / zeros (Phase 5)
8. (Optional) Create OPEN journey, run expire admin endpoint, see penalty

---

## 5. Acceptance criteria

- [x] Login/register works against new backend
- [x] Dashboard shows balance + media token
- [x] Tap simulator completes a round trip
- [x] Journey history + fare breakdown visible
- [x] Top-up + ledger visible
- [x] Cap status visible if Phase 5 merged
- [x] Vite proxy works in dev (no CORS pain)

**Audit:** [`phase_7_audit.md`](phase_7_audit.md)

## 6. Out of scope

- React/Vue rewrite
- Mobile native apps
- Admin CMS for fare rules
- Pixel-perfect redesign of old Bootstrap theme

## 7. Handoff notes for Phase 8

Capture screenshots for README. Note any manual demo steps (seed user credentials, validator codes).
