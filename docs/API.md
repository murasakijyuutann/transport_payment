# TransitPay API

Lightweight route reference for the ABT backend (`backend/`). All money amounts in API responses are decimal GBP strings (e.g. `"4.00"`). Domain logic uses integer pence internally.

Base URL (dev): `http://localhost:3000/api`  
Frontend Vite proxy: `/api` → `:3000`

Auth: `Authorization: Bearer <jwt>` unless noted.  
JWT claims: `sub` (user id), `accountId`, `role` (`CUSTOMER` | `STAFF` | `DEVICE`). Role is re-loaded from the DB on each request; suspended users/accounts are rejected.

Account-scoped resources (journeys, fare, ledger) are filtered by `accountId`. Cross-account ids return **404** (not 403).

---

## Auth

| Method | Path | Auth | Body | Success |
|--------|------|------|------|---------|
| POST | `/auth/register` | — | `{ email, password, firstName, lastName }` only (`.strict()` — extra fields like `riderCategoryId` → 400) | `201` `{ token, account }` — always `role: CUSTOMER`, rider `ADULT` |
| POST | `/auth/login` | — | `{ email, password }` | `200` `{ token, account }` |

`account` includes `role`.

## Account & wallet

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/account` | JWT | Balance, rider, media, **role** |
| GET | `/account/cap-status` | JWT | Daily cap headroom |
| POST | `/wallet/topup` | JWT | `{ amount }` pounds, mock provider — credits **caller only** |
| GET | `/account/wallet/ledger` | JWT | Caller’s ledger only |

## Travel

| Method | Path | Auth | Body / notes |
|--------|------|------|--------------|
| POST | `/taps` | — | `{ mediaToken, validatorId, timestamp }` — `validatorId` is validator **code** (device auth in S2) |
| GET | `/account/journeys` | JWT | Newest first |
| GET | `/account/journeys/:id` | JWT | 404 if not owned |
| GET | `/account/journeys/:id/fare` | JWT | 404 if not owned |

## Admin / demo

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/admin/stations` | — | Stations + validators (tap simulator catalog) |
| POST | `/admin/jobs/expire-journeys` | JWT + **STAFF** | Run incomplete-journey job now |
| GET | `/health` | — | Liveness |

Demo staff: `staff@example.com` / `password123` (after seed).

---

## Stable error codes

| Code | Typical HTTP | Meaning |
|------|--------------|---------|
| `JOURNEY_ALREADY_OPEN` | 409 | ENTRY while an OPEN journey exists |
| `NO_OPEN_JOURNEY` | 409 | EXIT with no OPEN journey |
| `JOURNEY_NOT_FOUND` | 404 | Unknown or **not owned** journey |
| `INSUFFICIENT_BALANCE` | 402 | Fare debit refused (EXIT rolls back; expire leaves PENDING) |
| `MEDIA_BLOCKED` | 403 | Fare media not ACTIVE |
| `MEDIA_NOT_FOUND` | 404 | Unknown media token |
| `VALIDATOR_NOT_FOUND` | 404 | Unknown validator code |
| `INVALID_CREDENTIALS` | 401 | Bad login |
| `EMAIL_TAKEN` | 409 | Register duplicate |
| `UNAUTHORIZED` | 401 | Missing/invalid JWT or inactive user/account |
| `FORBIDDEN` | 403 | Authenticated but wrong role |
| `VALIDATION_ERROR` | 400 | Bad payload (including unknown register fields) |

Error shape: `{ "error": string, "code": string }`.

---

## Sample tap sequence

```bash
# after login → token + CARD-DEMO-001
curl -X POST localhost:3000/api/taps -H 'Content-Type: application/json' \
  -d '{"mediaToken":"CARD-DEMO-001","validatorId":"VAL-CENTRAL-ENTRY-01","timestamp":"2026-09-20T10:00:00.000Z"}'

curl -X POST localhost:3000/api/taps -H 'Content-Type: application/json' \
  -d '{"mediaToken":"CARD-DEMO-001","validatorId":"VAL-RIVERSIDE-EXIT-01","timestamp":"2026-09-20T10:20:00.000Z"}'
```

Adult Central→Riverside: zone pair £4.00. Student: £2.00 after 50% discount.

```bash
# STAFF expire job
curl -X POST localhost:3000/api/admin/jobs/expire-journeys \
  -H "Authorization: Bearer $STAFF_TOKEN"
```
