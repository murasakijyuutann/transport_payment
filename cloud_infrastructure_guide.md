# Cloud Infrastructure Guide

## Overview

This guide maps the future Transport Payment System overhaul onto AWS infrastructure.

The application stack assumed here is:

```text
Backend:   Node.js + Express + TypeScript
Database:  PostgreSQL + Drizzle ORM + node-postgres
Frontend:  Vite + plain HTML/CSS/TypeScript
Testing:   Vitest + Supertest
Jobs:      scheduled incomplete-journey processing
Auth:      JWT
Deployment: Docker
```

The application should remain a **modular monolith** rather than being prematurely split into microservices.

The recommended AWS architecture is:

```text
                             Internet
                                │
                         Route 53 + ACM
                                │
                                ▼
                        ┌───────────────┐
                        │  CloudFront   │
                        └───────┬───────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
              /* │                             │ /api/*
                 ▼                             ▼
          ┌─────────────┐              ┌───────────────┐
          │     S3      │              │      ALB      │
          │ Vite build  │              │ HTTPS/API     │
          │ HTML/CSS/JS │              └───────┬───────┘
          └─────────────┘                      │
                                               ▼
                                    ┌───────────────────┐
                                    │   ECS Fargate     │
                                    │                   │
                                    │ Node.js           │
                                    │ Express           │
                                    │ TypeScript build  │
                                    │ Docker            │
                                    │ Drizzle           │
                                    └─────────┬─────────┘
                                              │
                                              │ pg
                                              ▼
                                    ┌───────────────────┐
                                    │ RDS PostgreSQL    │
                                    │                   │
                                    │ users             │
                                    │ journeys          │
                                    │ tap_events        │
                                    │ fare_calculations │
                                    │ fare_charges      │
                                    │ wallet ledger     │
                                    └───────────────────┘


               Background / infrastructure

            EventBridge Scheduler
                    │
                    ▼
             ECS scheduled task
                    │
                    ▼
        expireOpenJourneys()


            ECR                   Docker images

            Secrets Manager       DB password / JWT secret

            CloudWatch            logs / metrics / alarms

            SQS                   future asynchronous work

            WAF                   optional security layer
```

---

# 1. Frontend: S3 + CloudFront

The frontend is a static Vite application:

```text
HTML
CSS
TypeScript
Vite
```

After:

```bash
npm run build
```

Vite produces something like:

```text
frontend/dist/

index.html
assets/
    index-x72ab.js
    index-28c11.css
```

There is no need to run this inside Node.js or ECS.

Use:

```text
Amazon S3
    +
Amazon CloudFront
```

Deployment flow:

```text
npm run build
       │
       ▼
frontend/dist/
       │
       ▼
S3
       │
       ▼
CloudFront
       │
       ▼
Browser
```

S3 stores the static assets while CloudFront provides HTTPS delivery and CDN distribution.

---

# 2. Use the Same CloudFront Domain for Frontend and API

The frontend can continue using:

```typescript
const BASE = '/api';
```

CloudFront can route traffic like this:

```text
https://transport.example.com/
             │
             ├── /*       → S3
             │
             └── /api/*   → ALB → Express
```

Frontend calls remain simple:

```typescript
fetch('/api/taps')
```

Routing:

```text
/api/taps
    ↓
CloudFront
    ↓
ALB
    ↓
ECS Fargate
    ↓
Express
```

Static frontend files:

```text
/dashboard
/assets/app.js
/index.html
```

go to S3.

This avoids unnecessary CORS complexity.

---

# 3. Backend: Docker + ECS Fargate

The Express backend should be deployed as:

```text
Docker
   ↓
Amazon ECR
   ↓
Amazon ECS Fargate
```

Build flow:

```text
backend/
    │
    │ npm run build
    ▼
dist/
    │
    │ docker build
    ▼
Docker image
    │
    ▼
Amazon ECR
    │
    ▼
ECS Fargate
```

Example Dockerfile:

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/app.js"]
```

This gives the project a clean Node.js + TypeScript + Docker + AWS deployment story.

---

# 4. Why ECS Fargate Fits Better Than Lambda

The backend has one cohesive application flow:

```text
POST /api/taps
        ↓
TapService
        ↓
JourneyService
        ↓
FareService
        ↓
FareEngine
        ↓
CapService
        ↓
WalletService
        ↓
PostgreSQL transaction
```

This should remain inside one application process.

Recommended:

```text
Express
   ↓
ECS Fargate
   ↓
RDS PostgreSQL
```

Avoid unnecessarily splitting the core flow into:

```text
API Gateway
     │
     ├── Tap Lambda
     ├── Journey Lambda
     ├── Fare Lambda
     └── Wallet Lambda
```

That would introduce distributed-system complexity without providing a real benefit.

---

# 5. Why Not Plain EC2?

EC2 would work:

```text
EC2
  └── Docker
       └── Express
```

But Fargate reduces infrastructure work.

With EC2, you manage:

```text
OS
patching
instance sizing
Docker installation
instance replacement
autoscaling hosts
SSH/access
```

With Fargate, the main concerns become:

```text
Docker image
CPU
RAM
environment variables
networking
```

For this project, ECS Fargate provides a better balance between realism and maintainability.

---

# 6. ALB Instead of API Gateway

Recommended:

```text
CloudFront
   ↓
Application Load Balancer
   ↓
ECS Fargate
   ↓
Express
```

The ALB can distribute traffic between multiple ECS tasks:

```text
                    ALB
                  /     \
                 /       \
                ▼         ▼

         Express #1     Express #2
         ECS Task       ECS Task

                \         /
                 \       /
                  ▼     ▼

              PostgreSQL
```

The ECS service can scale horizontally:

```text
2 tasks
   ↓
4 tasks
   ↓
8 tasks
```

without changing the application architecture.

API Gateway is unnecessary for this design.

---

# 7. PostgreSQL: Use Amazon RDS

The domain is strongly relational:

```text
User
TransitAccount
FareMedia
Wallet

Zone
Station
Validator

TapEvent
Journey

FareRule
FareCalculation
FareCharge

FareAccumulator

WalletLedgerEntry
PaymentTransaction
Refund
```

It also needs:

```text
UUID primary keys
NUMERIC money values
TIMESTAMPTZ
foreign keys
transactions
unique indexes
append-only ledger records
```

Use:

```text
Amazon RDS for PostgreSQL
```

Do not add DynamoDB or DocumentDB simply for architectural complexity.

PostgreSQL should remain the source of truth.

---

# 8. Keep PostgreSQL Private

Recommended network structure:

```text
VPC
│
├── Public Subnets
│      │
│      └── Application Load Balancer
│
├── Private Application Subnets
│      │
│      └── ECS Fargate
│
└── Private Database Subnets
       │
       └── RDS PostgreSQL
```

The request path should be:

```text
Internet
   ↓
CloudFront
   ↓
ALB
   ↓
Express
   ↓
RDS
```

Never:

```text
Internet
   ↓
RDS
```

Recommended security groups:

```text
ALB Security Group
    accepts:
        443

ECS Security Group
    accepts:
        application port
        ONLY from ALB Security Group

RDS Security Group
    accepts:
        5432
        ONLY from ECS Security Group
```

---

# 9. Replace Production node-cron with EventBridge Scheduler

The application currently contains scheduled incomplete-journey processing.

Locally, this is fine:

```typescript
cron.schedule('*/5 * * * *', async () => {
    await journeyService.expireOpenJourneys();
});
```

But this becomes unsafe when ECS scales.

Example:

```text
ECS task #1
node-cron → RUN

ECS task #2
node-cron → RUN

ECS task #3
node-cron → RUN
```

All three containers could execute the same job.

In production, use:

```text
Amazon EventBridge Scheduler
        │
        ▼
Scheduled ECS Task
        │
        ▼
expireOpenJourneys()
```

This guarantees that scheduling responsibility is external to the API containers.

---

# 10. Keep the Same TypeScript Job

The job logic can remain reusable.

Example:

```text
backend/src/jobs/
    expireIncompleteJourneys.ts
```

```typescript
async function main() {
    await journeyService.expireOpenJourneys();
    process.exit(0);
}

main();
```

Development:

```text
node-cron
    ↓
expireOpenJourneys()
```

Production:

```text
EventBridge Scheduler
        │
        │ every 5 minutes
        ▼
Run ECS Task
        │
        ▼
node dist/jobs/expireIncompleteJourneys.js
        │
        ▼
RDS PostgreSQL
```

The domain logic stays unchanged.

Only the scheduling mechanism changes.

---

# 11. node-cron Still Has a Place

Keep `node-cron` for local development if desired.

Local:

```text
Express
PostgreSQL Docker
node-cron
Vite
```

AWS:

```text
Express      → ECS Fargate
PostgreSQL   → RDS
cron         → EventBridge Scheduler
```

This provides consistent business logic across environments.

---

# 12. SQS Is Not Required for Phase 1

The main transactional flow should stay synchronous:

```text
Tap
 ↓
Journey
 ↓
Fare
 ↓
Wallet
```

The critical path should remain:

```text
POST /api/taps
       ↓
TapEvent
       ↓
Journey completed
       ↓
FareCalculation
       ↓
FareCharge
       ↓
WalletLedgerEntry
       ↓
COMMIT
```

The financial writes should remain within one PostgreSQL transaction.

Do not queue the core fare/wallet path unnecessarily.

---

# 13. SQS Becomes Useful in Phase 2

SQS becomes useful for workflows that do not need to complete in the user's request transaction.

Examples:

## External payment processing

```text
FareCharge
    │
    ▼
payment required
    │
    ▼
SQS
    │
    ▼
Payment Worker
    │
    ▼
Stripe / external provider
```

## Refund processing

```text
Journey corrected
       │
       ▼
Refund requested
       │
       ▼
SQS
       │
       ▼
Refund Worker
```

## Debt recovery

```text
Payment failed
      │
      ▼
SQS
      │
      ▼
Debt Recovery Worker
```

This is where asynchronous architecture becomes valuable.

---

# 14. Natural Phase 2 Evolution

## Phase 1

```text
                 CloudFront
                /          \
               /            \
             S3             ALB
                              │
                         ECS Fargate
                              │
                          PostgreSQL

EventBridge Scheduler ──→ ECS scheduled task
```

## Phase 2

```text
                         ALB
                          │
                    Express API
                          │
           ┌──────────────┼──────────────┐
           │              │              │
           ▼              ▼              ▼
       PostgreSQL        SQS            SQS
                         │              │
                         ▼              ▼
                   Payment Worker  Refund Worker
```

The system can still remain one repository:

```text
backend/
├── api
├── domain
├── services
├── workers
└── jobs
```

There is no need to introduce microservices yet.

---

# 15. Use AWS Secrets Manager

Local development:

```text
.env
```

Production should use:

```text
AWS Secrets Manager
```

Examples:

```text
/transport/prod/database-url
/transport/prod/jwt-secret
```

ECS receives these values at runtime using IAM permissions.

Do not bake secrets into the Docker image.

The same Docker image should be usable across:

```text
DEV
STAGING
PROD
```

with different environment configuration.

---

# 16. Use Amazon ECR

Amazon ECR should store private Docker images.

Deployment flow:

```text
GitHub
   │
   ▼
GitHub Actions
   │
   ├── npm ci
   ├── npm test
   ├── npm run build
   │
   ├── docker build
   │
   ▼
Amazon ECR
   │
   ▼
ECS Deployment
```

Example tags:

```text
transport-api:1.0.0
transport-api:1.1.0
transport-api:git-a92f42c
```

This is preferable to manually copying application files to servers.

---

# 17. CloudWatch for Logs and Metrics

Application logs:

```text
ECS Express logs
        │
        ▼
CloudWatch Logs
```

Prefer structured logs over unstructured strings.

Example:

```json
{
    "level": "error",
    "event": "fare_calculation_failed",
    "journeyId": "...",
    "accountId": "...",
    "timestamp": "..."
}
```

Useful CloudWatch metrics and alarms include:

```text
HTTP 5xx
ALB response time
ECS CPU
ECS memory
RDS CPU
RDS connection count
SQS queue depth
failed scheduled tasks
```

This gives the project an operational monitoring story in addition to application development.

---

# 18. RDS Proxy Is Optional

Initially:

```text
ECS
  ↓
pg Pool
  ↓
RDS PostgreSQL
```

is enough.

For a small number of ECS tasks, `node-postgres` connection pooling is appropriate.

RDS Proxy may become useful later if the architecture grows into:

```text
many ECS tasks
Lambda consumers
large scaling bursts
many short-lived connections
```

Then:

```text
ECS / Lambda
      ↓
RDS Proxy
      ↓
PostgreSQL
```

can become useful.

Do not add it initially without a need.

---

# 19. Lambda Is Optional, Not Core

Lambda can be useful later for small event-driven jobs.

Examples:

```text
S3 event
   ↓
Lambda
   ↓
small transformation
```

or:

```text
SQS
 ↓
Lambda
 ↓
webhook processor
```

But do not build the main Express backend around Lambda.

Keep:

```text
Express
    ↓
ECS Fargate
```

The scheduled incomplete-journey job can also stay as an ECS scheduled task.

---

# 20. API Gateway Is Not Needed

Avoid:

```text
CloudFront
   ↓
API Gateway
   ↓
ALB
   ↓
ECS
```

That adds an unnecessary layer.

Use:

```text
CloudFront
   ↓
ALB
   ↓
ECS
```

API Gateway makes more sense if the architecture later becomes:

```text
API Gateway
    ↓
Lambda
```

but that is not the current design.

---

# 21. CI/CD

Use GitHub Actions.

## Backend pipeline

```text
git push main
       │
       ▼
GitHub Actions
       │
       ├── npm ci
       ├── npm run typecheck
       ├── Vitest
       ├── Supertest
       ├── npm run build
       │
       ├── docker build
       ├── push ECR
       │
       └── deploy ECS
```

## Frontend pipeline

```text
git push main
       │
       ▼
npm run build
       │
       ▼
dist/
       │
       ▼
S3
       │
       ▼
CloudFront invalidation
```

This provides a clear CI/CD story without introducing CodePipeline or CodeBuild unless there is a later reason to use them.

---

# 22. Drizzle Migration Strategy

Do not let every ECS API task automatically run migrations during startup.

Problem:

```text
Task 1 starts → migration
Task 2 starts → migration
Task 3 starts → migration
```

Instead:

```text
Deployment
    │
    ├── build image
    │
    ├── run ONE migration task
    │       │
    │       ▼
    │      RDS
    │
    └── deploy new ECS service
```

Use a one-off ECS task such as:

```text
npm run db:migrate
```

before rolling out the new API task definition.

---

# 23. Keep Wallet Operations in One PostgreSQL Transaction

The wallet architecture requires:

```text
FareCharge
+
WalletLedgerEntry
+
Wallet balance update
```

to succeed atomically.

Keep this inside:

```text
Express
        │
        ▼
PostgreSQL transaction
        │
 ┌──────┼──────┐
 ▼      ▼      ▼
fare   ledger  wallet
```

Do not turn this into:

```text
Fare Lambda
    ↓
SQS
    ↓
Ledger Lambda
    ↓
SQS
    ↓
Wallet Lambda
```

That would replace one simple ACID transaction with a distributed consistency problem.

The core financial transaction should remain relational and synchronous.

---

# 24. Recommended AWS Service Mapping

| Application Component | AWS Infrastructure |
|---|---|
| Vite HTML/CSS/TypeScript | S3 |
| Frontend distribution | CloudFront |
| Express + TypeScript | ECS Fargate |
| Docker images | ECR |
| HTTP routing | Application Load Balancer |
| PostgreSQL | RDS PostgreSQL |
| Drizzle migrations | One-off ECS task |
| Production scheduler | EventBridge Scheduler |
| Incomplete journey job | Scheduled ECS Fargate task |
| Async Phase 2 work | SQS |
| Failed queue messages | SQS Dead-Letter Queue |
| Secrets | Secrets Manager |
| Logs and metrics | CloudWatch |
| DNS | Route 53 |
| TLS certificates | ACM |
| Security filtering | WAF, optional |
| CI/CD | GitHub Actions |
| API Gateway | Not required |
| Lambda | Optional later |
| EC2 | Not required initially |
| DynamoDB | Not required |

---

# 25. Recommended Portfolio Deployment

The first deployed version should be:

```text
                   CloudFront
                  /          \
                 ▼            ▼
                S3           ALB
                 │            │
             Vite UI          ▼
                         ECS Fargate
                         Express API
                              │
                              ▼
                       RDS PostgreSQL


EventBridge Scheduler
         │
         ▼
scheduled ECS task
expireOpenJourneys()


ECR
Secrets Manager
CloudWatch
Route 53
ACM
```

This already demonstrates:

```text
AWS networking
container deployment
managed PostgreSQL
static frontend hosting
scheduled workloads
CI/CD
secret management
monitoring
```

without unnecessary complexity.

Phase 2 can add:

```text
SQS
worker ECS services
real payment provider
SQS DLQ
WAF
RDS Multi-AZ
ECS autoscaling
```

---

# 26. Docker Usage

## Local Development

A local Docker Compose setup can provide PostgreSQL:

```text
docker-compose.yml

┌──────────────────┐
│ PostgreSQL       │
└──────────────────┘
        ▲
        │
┌──────────────────┐
│ Express backend  │
└──────────────────┘
```

The frontend can run directly with:

```bash
npm run dev
```

for better Vite hot reload.

## AWS

```text
Dockerfile
    ↓
Docker image
    ↓
Amazon ECR
    ↓
ECS Fargate
```

This keeps the application boundary consistent between development and production.

---

# 27. Final AWS Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                            AWS                               │
│                                                              │
│                       Route 53 + ACM                         │
│                              │                               │
│                              ▼                               │
│                       ┌────────────┐                         │
│                       │ CloudFront │                         │
│                       └─────┬──────┘                         │
│                             │                                │
│                ┌────────────┴────────────┐                   │
│                │                         │                   │
│                ▼                         ▼                   │
│          ┌──────────┐              ┌──────────┐             │
│          │    S3    │              │   ALB    │             │
│          │ Vite App │              └────┬─────┘             │
│          └──────────┘                   │                   │
│                                         ▼                   │
│                                ┌────────────────┐            │
│                                │  ECS Fargate   │            │
│                                │                │            │
│                                │ Node.js        │            │
│                                │ Express        │            │
│                                │ TypeScript     │            │
│                                │ Drizzle ORM    │            │
│                                └───────┬────────┘            │
│                                        │                     │
│                                        ▼                     │
│                              ┌──────────────────┐             │
│                              │ RDS PostgreSQL   │             │
│                              └──────────────────┘             │
│                                                              │
│ EventBridge Scheduler ─────→ Scheduled ECS Task              │
│                                                              │
│ ECR              ← Docker images                             │
│ Secrets Manager  ← secrets                                   │
│ CloudWatch       ← logs / metrics                            │
│ SQS              ← Phase 2 async processing                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

# Final Recommendation

For the future Transport Payment System overhaul, the recommended AWS combination is:

```text
S3
+
CloudFront
+
Application Load Balancer
+
ECS Fargate
+
ECR
+
RDS PostgreSQL
+
EventBridge Scheduler
+
Secrets Manager
+
CloudWatch
```

Add:

```text
SQS
+
SQS Dead-Letter Queue
+
worker ECS services
```

when Phase 2 introduces asynchronous payment processing, refunds, payment aggregation, debt recovery, or similar workflows.

Avoid introducing:

```text
API Gateway
Lambda
DynamoDB
EC2
microservices
```

unless a future requirement specifically justifies them.

The guiding principle is the same as the application's domain architecture:

```text
TapEvent
   ↓
Journey
   ↓
FareCalculation
   ↓
FareCharge
   ↓
WalletLedgerEntry
   ↓
PaymentTransaction
```

Keep responsibilities separate, but do not split coherent transactional work across infrastructure boundaries without a real reason.
