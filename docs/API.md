# TransitPay API

Lightweight route reference for the ABT backend (`backend/`). All money amounts in API responses are decimal GBP strings (e.g. `"4.00"`). Domain logic uses integer pence internally.

Base URL (dev): `http://localhost:3000/api`  
Frontend Vite proxy: `/api` → `:3000`

Auth: `Authorization: Bearer <jwt>` unless noted.

---

## Auth

| Method | Path | Auth | Body | Success |
|--------|------|------|------|---------|
| POST | `/auth/register` | — | `{ email, password, firstName, lastName }` | `201` `{ token, account }` |
| POST | `/auth/login` | — | `{ email, password }` | `200` `{ token, account }` |

## Account & wallet

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/account` | JWT | Balance, rider, media tokens |
| GET | `/account/cap-status` | JWT | Daily cap headroom |
| POST | `/wallet/topup` | JWT | `{ amount }` pounds, mock provider |
| GET | `/account/wallet/ledger` | JWT | Balance + ledger entries |

## Travel

| Method | Path | Auth | Body / notes |
|--------|------|------|--------------|
| POST | `/taps` | — | `{ mediaToken, validatorId, timestamp }` — `validatorId` is validator **code** |
| GET | `/account/journeys` | JWT | Newest first |
| GET | `/account/journeys/:id` | JWT | Journey detail |
| GET | `/account/journeys/:id/fare` | JWT | Fare breakdown + charge |

## Admin / demo

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/admin/stations` | — | Stations + validators (tap simulator) |
| POST | `/admin/jobs/expire-journeys` | — | Run incomplete-journey job now |
| GET | `/health` | — | Liveness |

---

## Stable error codes

| Code | Typical HTTP | Meaning |
|------|--------------|---------|
| `JOURNEY_ALREADY_OPEN` | 409 | ENTRY while an OPEN journey exists |
| `NO_OPEN_JOURNEY` | 409 | EXIT with no OPEN journey |
| `INSUFFICIENT_BALANCE` | 402 | Fare debit refused (EXIT rolls back; expire leaves PENDING) |
| `MEDIA_BLOCKED` | 403 | Fare media not ACTIVE |
| `MEDIA_NOT_FOUND` | 404 | Unknown media token |
| `VALIDATOR_NOT_FOUND` | 404 | Unknown validator code |
| `INVALID_CREDENTIALS` | 401 | Bad login |
| `EMAIL_TAKEN` | 409 | Register duplicate |
| `UNAUTHORIZED` | 401 | Missing/invalid JWT |
| `VALIDATION_ERROR` | 400 | Bad payload |

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
