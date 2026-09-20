# Transport Payment System Overhaul

## Overview

This document redesigns the original transport payment backend into a more realistic and auditable account-based transit payment system.

The original prototype used five core entities:

```text
User
Card
Station
Journey
Transaction
```

The redesigned model separates:

- customer/account identity
- fare media
- physical transport network
- tap events
- journeys
- fare calculation
- fare charging
- wallet accounting
- external payment transactions

The main architectural goal is to ensure that each stage in the information flow represents one clear business concept.

---

# 1. Use Account-Based Ticketing

A modern transport payment backend should be designed around **Account-Based Ticketing (ABT)**.

Instead of storing most travel/payment state directly on a card:

```text
Card
 ├─ balance
 ├─ journeys
 └─ fare information
```

the physical card or device should mainly act as an identifier:

```text
Fare Media
    ↓ identifies
Transit Account
    ↓ owns
Journey / balance / fare state
```

The redesigned model becomes:

```text
                    User
                      │
                      │ owns
                      ▼
               TransitAccount
                 /         \
                /           \
               ▼             ▼
         FareMedia          Wallet
             │                │
             │                │
             ▼                ▼
          TapEvent       LedgerEntry
             │
             ▼
           Journey
             │
             ▼
       FareCalculation
             │
             ▼
          FareCharge
             │
             ▼
      PaymentTransaction
```

The physical card should not be treated as the source of truth for journeys or account state.

---

# 2. Recommended Domain Model

Divide the system into five main domains.

```text
┌─────────────────────────────┐
│ 1. Customer / Account       │
│ User                        │
│ TransitAccount              │
│ FareMedia                   │
│ Wallet                      │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 2. Transport Network        │
│ Station                     │
│ Zone                        │
│ Route                       │
│ TransportMode               │
│ Validator                   │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 3. Travel                   │
│ TapEvent                    │
│ Journey                     │
│ JourneyLeg                  │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 4. Fare                     │
│ FareProduct                 │
│ FareRule                    │
│ FareCalculation             │
│ FareCap                     │
│ RiderCategory               │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 5. Financial                │
│ FareCharge                  │
│ WalletLedgerEntry           │
│ PaymentTransaction          │
│ Refund                      │
└─────────────────────────────┘
```

This is preferable to putting unrelated business concepts into a single `Transaction` or `Journey` entity.

---

# 3. User Should Not Be the Centre of Every Transaction

The `User` entity should represent authentication and customer identity.

Do not make journeys directly depend on `User`.

Use:

```text
User
  │
  │ 1:1 or 1:N
  ▼
TransitAccount
  │
  │ 1:N
  ▼
FareMedia
```

## User

```text
User
----
id
email
passwordHash
firstName
lastName
status
createdAt
```

Responsibilities:

- login identity
- authentication
- profile information
- admin/customer role

## TransitAccount

```text
TransitAccount
--------------
id
userId
status
riderCategoryId
createdAt
```

Responsibilities:

- travel identity
- fare state
- rider category
- linked fare media
- wallet relationship

This separation allows:

```text
User = person/login identity

TransitAccount = travel/payment identity
```

An administrator can therefore be a `User` without necessarily being a passenger.

It also allows future structures such as:

```text
Parent User
    ├── Adult TransitAccount
    └── Child TransitAccount
```

---

# 4. Replace Card with FareMedia

Instead of designing only around a physical transit card, use a more general entity:

```text
FareMedia
```

Possible media types include:

- transit card
- contactless bank card
- mobile wallet
- QR code

## FareMedia

```text
FareMedia
---------
id
transitAccountId
mediaType
token
status
issuedAt
expiresAt
lastUsedAt
```

Example enum:

```java
enum FareMediaType {
    TRANSIT_CARD,
    CONTACTLESS_BANK_CARD,
    MOBILE_WALLET,
    QR_CODE
}
```

For version 1, the project can support only:

```text
TRANSIT_CARD
```

while still keeping the domain flexible.

---

# 5. Introduce TapEvent

`TapEvent` should be a first-class entity.

Do not directly store tap-in and tap-out as arbitrary journey fields without preserving the original events.

A tap is a real-world fact.

## TapEvent

```text
TapEvent
--------
id
mediaId
validatorId
stationId
tapType
eventTime
receivedAt
status
```

Example entry tap:

```json
{
  "mediaId": 492,
  "validatorId": 17,
  "stationId": 21,
  "tapType": "ENTRY",
  "eventTime": "2026-09-20T08:13:42+09:00"
}
```

Example exit tap:

```json
{
  "mediaId": 492,
  "validatorId": 83,
  "stationId": 45,
  "tapType": "EXIT",
  "eventTime": "2026-09-20T08:47:11+09:00"
}
```

These events allow the backend to construct:

```text
Journey
=======
origin       = Station 21
destination  = Station 45
startTime    = 08:13:42
endTime      = 08:47:11
```

The important distinction is:

```text
TapEvent = fact

Journey = interpretation of facts
```

---

# 6. Add Validator

A tap should occur against a physical or logical validation device.

```text
Station
   │
   ├── Validator #A
   ├── Validator #B
   ├── Validator #C
   └── Validator #D
```

## Validator

```text
Validator
---------
id
stationId
validatorCode
type
status
lastHeartbeatAt
```

Possible validator types:

```java
ENTRY_GATE
EXIT_GATE
BIDIRECTIONAL_GATE
BUS_READER
INSPECTION_TERMINAL
```

A realistic tap endpoint would be:

```http
POST /api/taps
```

Example request:

```json
{
    "mediaToken": "CARD-ABC-829301",
    "validatorId": "VAL-WAT-ENTRY-04",
    "timestamp": "2026-09-20T08:13:42Z"
}
```

The backend should infer what the event means.

---

# 7. Separate Station and Zone

Instead of:

```text
Station
-------
id
name
zone
```

use:

```text
Zone
----
id
code
name
```

and:

```text
Station
-------
id
name
zoneId
```

Example:

```text
Zone 1
 ├── Central
 ├── City Hall
 └── Museum

Zone 2
 ├── Riverside
 ├── Airport East
 └── Green Park
```

Now a fare engine can reason about:

```text
Zone 1 → Zone 3
```

without embedding tariff logic inside the station itself.

---

# 8. Add Route, Network, and TransportMode

This is optional for version 1 but recommended in the domain model.

## TransportMode

Possible values:

```text
TRAIN
METRO
BUS
TRAM
FERRY
```

## Route

```text
Route
-----
id
name
mode
operatorId
```

This matters because fares may depend on more than zones.

Example:

```text
Airport Express:
Zone 1 → Zone 3 = £12

Normal Metro:
Zone 1 → Zone 3 = £5
```

The zones are the same, but the route or service type changes the fare.

---

# 9. Journey Should Be Created from TapEvents

## Journey

```text
Journey
-------
id
transitAccountId
mediaId

entryTapId
exitTapId

originStationId
destinationStationId

startedAt
completedAt

status
```

Possible statuses:

```java
OPEN
COMPLETED
INCOMPLETE_ENTRY
INCOMPLETE_EXIT
EXPIRED
CORRECTED
```

Example flow:

```text
CARD tapped at Paddington
        ↓
TapEvent #1001
        ↓
Journey #501
status = OPEN
```

Later:

```text
CARD tapped at King's Cross
        ↓
TapEvent #1019
        ↓
Journey #501
status = COMPLETED
```

Then:

```text
FareEngine.calculate(Journey #501)
```

---

# 10. Incomplete Journey Behaviour

An incomplete journey should be a natural state in the model.

Example:

```text
08:00
ENTRY tap
    ↓
Journey OPEN

12:00
no EXIT
    ↓
maxJourneyDuration reached

12:01
Journey
status = INCOMPLETE_ENTRY
```

Then:

```text
FareEngine
     ↓
IncompleteJourneyRule
     ↓
£5.00
```

This is cleaner than placing timeout checks randomly inside general journey logic.

---

# 11. Do Not Let Journey Calculate Its Own Fare

Fare calculation should be handled by a dedicated fare engine.

```text
Journey
   │
   ▼
FareContext
   │
   ▼
FareEngine
   │
   ├── ZoneRule
   ├── TimeRule
   ├── RiderCategoryRule
   ├── TransferRule
   ├── IncompleteJourneyRule
   └── CapRule
   │
   ▼
FareCalculation
```

This prevents the `Journey` domain model from becoming overloaded with pricing policy.

---

# 12. Introduce FareRule

Simple prototype pricing might begin with:

```yaml
base-fare: 2.50
per-zone-charge: 1.50
```

But real pricing should eventually become data-driven.

## FareRule

```text
FareRule
--------
id
ruleType
originZoneId
destinationZoneId
transportMode
riderCategoryId
timeBandId
amount
priority
validFrom
validUntil
```

Example:

```text
Zone 1 → Zone 1 = £2.50
Zone 1 → Zone 2 = £4.00
Zone 1 → Zone 3 = £5.50
```

This is preferable to hard-coding:

```java
fare = baseFare + zoneDifference * perZoneCharge;
```

because tariff policy may later introduce:

```text
Airport route surcharge = £3
Weekend fare = £2
Student = 50%
Peak Zone 1-4 = £6.80
```

---

# 13. Add FareProduct

## FareProduct

```text
FareProduct
-----------
id
name
type
price
currency
```

Possible products:

```text
SINGLE_JOURNEY
DAILY_PASS
WEEKLY_PASS
AIRPORT_EXPRESS
STUDENT_SINGLE
```

A fare engine may select a product dynamically.

Example:

```text
Journey
   ↓
matches
   ↓
Zone1ToZone3AdultPeak
   ↓
FareProduct
£5.50
```

---

# 14. Add RiderCategory

## RiderCategory

```text
RiderCategory
-------------
id
name
discountPercent
```

Examples:

```text
ADULT
STUDENT
CHILD
SENIOR
```

Relationship:

```text
TransitAccount
       │
       ▼
RiderCategory
```

Do not hard-code fare eligibility using logic such as:

```java
if (user.getAge() < 18) ...
```

Store the rider category as business data.

---

# 15. Store FareCalculation

Fare calculation should be auditable.

Do not merely calculate:

```java
BigDecimal fare = calculateFare(journey);
```

and discard the reasoning.

## FareCalculation

```text
FareCalculation
---------------
id
journeyId

baseFare
zoneCharge
timeAdjustment
discount
capAdjustment
penalty

originalFare
finalFare

fareRuleId

calculatedAt
version
```

Example:

```text
Base fare             £2.50
Zone surcharge        £3.00
Student discount     -£1.10
Daily cap adjustment -£0.90
--------------------------------
Final fare             £3.50
```

This allows the system to answer:

> Why was this passenger charged £3.50?

That is valuable for:

- customer support
- debugging
- auditing
- financial reconciliation
- interview discussion

---

# 16. Separate FareCharge from PaymentTransaction

A generic entity called `Transaction` is too ambiguous.

It could mean:

```text
tap
fare
wallet deduction
bank charge
refund
top-up
```

Use separate domain entities.

At minimum:

```text
FareCharge
PaymentTransaction
WalletLedgerEntry
```

---

# 17. FareCharge

`FareCharge` represents the transport system's financial claim for travel.

## FareCharge

```text
FareCharge
----------
id
journeyId
fareCalculationId
accountId
amount
status
chargedAt
```

Example:

```text
Journey 501
→ £4.00
```

Meaning:

> Journey 501 costs £4.00 and the passenger owes that amount.

This is distinct from money actually entering or leaving an external bank account.

---

# 18. WalletLedgerEntry

If the system supports stored value, use a wallet.

## Wallet

```text
Wallet
------
id
accountId
balance
currency
```

More importantly, use a ledger.

## WalletLedgerEntry

```text
WalletLedgerEntry
-----------------
id
walletId
type
amount
balanceAfter
referenceType
referenceId
createdAt
```

Example types:

```text
TOP_UP
FARE
REFUND
ADJUSTMENT
```

Example history:

```text
09:00 TOP_UP       +£30.00 → £30.00
10:12 FARE          -£4.00 → £26.00
12:22 FARE          -£3.00 → £23.00
15:01 REFUND        +£1.50 → £24.50
```

This is much safer and more auditable than only doing:

```java
wallet.balance -= fare;
```

---

# 19. PaymentTransaction

`PaymentTransaction` should represent external money movement.

## PaymentTransaction

```text
PaymentTransaction
------------------
id
accountId
type
provider
providerReference
amount
currency
status
createdAt
completedAt
```

Possible types:

```text
TOP_UP
BANK_CHARGE
REFUND
DEBT_RECOVERY
```

Conceptual distinction:

```text
PaymentTransaction
```

answers:

> Did £20 enter the transport system from Visa?

while:

```text
FareCharge
```

answers:

> How much did the passenger owe for Journey 501?

and:

```text
WalletLedgerEntry
```

answers:

> How did the stored-value balance change?

These are three different questions and should be separate entities.

---

# 20. Support Aggregated Payment

Open-loop transit systems may aggregate travel before charging the payment provider.

Example:

```text
Tap
Tap
Tap
Tap
    ↓
Journeys
    ↓
Fare calculations
    ↓
Daily aggregation
    ↓
ONE payment transaction
```

This is different from:

```text
tap → Visa payment
tap → Visa payment
tap → Visa payment
```

That is another reason why travel and external payment must be separated.

---

# 21. Daily Capping Should Be Its Own Concept

Do not put simple cap logic directly into `JourneyService`.

Instead introduce a fare cap domain.

## FareCap

```text
FareCap
-------
id
capType
amount
scope
validFrom
validTo
```

## FareAccumulator

```text
FareAccumulator
---------------
accountId
periodType
periodStart
eligibleSpend
chargedAmount
capAmount
```

Example daily flow:

```text
Journey #1 = £5
Daily total = £5

Journey #2 = £6
Daily total = £11

Journey #3 normally = £5
Remaining cap = £4

Journey #3 charged = £4

Daily total = £15

Journey #4 = £0
```

This is much more extensible than:

```java
if (todaysTotal > 15) {
    fare = 0;
}
```

inside unrelated services.

---

# 22. Complete Tap-In Information Flow

A consistent tap-in flow should look like:

```text
Passenger
    │
    │ taps card
    ▼
Validator
    │
    │ mediaToken
    │ validatorId
    │ timestamp
    ▼
TapController
    │
    ▼
TapService
    │
    ├─ resolve FareMedia
    ├─ resolve TransitAccount
    ├─ check media status
    ├─ check account status
    └─ save TapEvent
             │
             ▼
       JourneyService
             │
             ├─ look for open journey
             │
             └─ none found
                    │
                    ▼
             Create Journey
             status = OPEN
```

No fare needs to be finalized yet.

---

# 23. Complete Tap-Out Information Flow

```text
Passenger
    │
    ▼
Validator
    │
    ▼
TapEvent
    │
    ▼
JourneyService
    │
    ├─ find OPEN journey
    ├─ assign exit tap
    ├─ destination station
    ├─ completedAt
    └─ status = COMPLETED
             │
             ▼
        FareService
             │
             ▼
         FareEngine
             │
      ┌──────┼────────┐
      │      │        │
     Zone   Time    Rider
     Rule   Rule    Category
      │      │        │
      └──────┼────────┘
             ▼
      FareCalculation
             │
             ▼
         CapService
             │
             ▼
         FareCharge
             │
             ▼
        WalletService
             │
             ▼
       LedgerEntry
```

This keeps the flow deterministic and easy to test.

---

# 24. Incomplete Journey Processing Flow

```text
ENTRY
  ↓
Journey OPEN
  ↓
4 hours pass
  ↓
Journey timeout job
  ↓
Journey = INCOMPLETE
  ↓
IncompleteJourneyFareRule
  ↓
£5.00 penalty
  ↓
FareCalculation
  ↓
FareCharge
  ↓
LedgerEntry
```

A later correction could work like this:

```text
Customer submits missing exit
        ↓
JourneyCorrection
        ↓
recalculate fare
        ↓
old £5 charge
actual £3 fare
        ↓
Refund £2
```

This gives the backend a clean path for correction and refund workflows.

---

# 25. Resulting Entity Relationships

## Customer / Travel Side

```text
User
 │ 1
 │
 │ 1
TransitAccount
 │
 ├────────────── 1:N ───────────── FareMedia
 │                                  │
 │                                  │
 │                                  ▼
 │                              TapEvent
 │                                  │
 │                                  │
 │                                  ▼
 │                              Journey
 │                                  │
 │                                  ▼
 │                           FareCalculation
 │                                  │
 │                                  ▼
 │                             FareCharge
 │
 ├────────────── 1:1 ───────────── Wallet
 │                                  │
 │                                  ▼
 │                           WalletLedgerEntry
 │
 └────────────── 1:N ───── PaymentTransaction
```

## Transport Network

```text
Zone
 │
 └── Station
       │
       └── Validator
             │
             └── TapEvent
```

## Fare Domain

```text
RiderCategory
       │
TransitAccount

FareProduct
     ▲
     │
FareRule
 ├─ originZone
 ├─ destinationZone
 ├─ route
 ├─ transportMode
 ├─ timeframe
 └─ riderCategory
```

---

# 26. Revised Entity List

The original model:

```text
User
Card
Station
Journey
Transaction
```

should evolve into:

```text
CORE ACCOUNT
------------
User
TransitAccount
FareMedia
Wallet

NETWORK
-------
Zone
Station
Validator
Route

TRAVEL
------
TapEvent
Journey

FARE
----
FareProduct
FareRule
FareCalculation
FareCap
RiderCategory

FINANCIAL
---------
FareCharge
WalletLedgerEntry
PaymentTransaction
Refund
```

Not all entities need to be implemented in version 1, but the architecture should account for them.

---

# 27. Recommended Portfolio Scope

Do not try to reproduce a full production transit network immediately.

A strong portfolio scope would be:

```text
Account-based backend

Fare media:
    proprietary transit card

Network:
    Train/Metro
    stations
    zones

Travel:
    tap-in
    tap-out
    incomplete journeys

Pricing:
    zone-based fare
    adult/student fares
    daily cap

Payment:
    prepaid wallet
    top-up
    fare deduction
    refund

Audit:
    fare calculation breakdown
    immutable wallet ledger
```

Then later add:

```text
Phase 2

Open-loop Visa/Mastercard
weekly capping
peak/off-peak fares
transfers
multiple transport modes
auto top-up
journey correction
payment aggregation
debt recovery
```

---

# Final Architectural Principle

The information flow should be:

```text
             REAL-WORLD EVENT
                    │
                    ▼
                 TapEvent
                    │
                    ▼
                 Journey
                    │
                    ▼
             FareCalculation
                    │
                    ▼
                FareCharge
                    │
                    ▼
            Financial Ledger
                    │
                    ▼
           External Payment
```

Each layer answers a different question.

```text
TapEvent
"What physically happened?"

Journey
"What trip did those events represent?"

FareCalculation
"What should this trip cost, and why?"

FareCharge
"What does the passenger owe?"

WalletLedgerEntry
"How did their stored value change?"

PaymentTransaction
"What external money moved?"
```

This separation makes the backend:

- consistent
- testable
- auditable
- easier to extend
- easier to debug
- closer to real transport payment architecture
- better suited for demonstrating backend/system-design ability in a portfolio
