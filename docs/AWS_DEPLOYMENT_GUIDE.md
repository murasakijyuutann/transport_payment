# AWS Deployment Guide — TransitPay (ABT)

Step-by-step guide to deploy **this repository** on AWS, following [`cloud_infrastructure_guide.md`](../cloud_infrastructure_guide.md).

Target architecture (portfolio v1):

```text
Internet → Route 53 + ACM → CloudFront
                               ├── /*      → S3 (Vite MPA)
                               └── /api/*  → ALB → ECS Fargate (Express)
                                                      ↓
                                               RDS PostgreSQL

EventBridge (every 5 min) → one-off ECS task → expireOpenJourneys()
```

| Repo piece | AWS |
|------------|-----|
| `frontend/` (`npm run build` → `dist/`) | S3 + CloudFront |
| `backend/` Express on `:3000` | ECS Fargate + ALB |
| Postgres `transport_abt` | RDS PostgreSQL |
| `node-cron` in `server.ts` (local only) | EventBridge → scheduled ECS task |
| `.env` secrets | Secrets Manager |
| Docker image | ECR |
| Logs | CloudWatch |

**Not in v1:** API Gateway, Lambda for the API, DynamoDB, Redis, SQS workers.

---

## 0. Prerequisites

### Accounts & tools

- AWS account with billing enabled
- AWS CLI v2 configured (`aws configure` or SSO)
- Docker Desktop running
- Node.js 22+
- A domain you control (optional but recommended for HTTPS via ACM + Route 53)
- GitHub repo access (for CI later)

### Cost mindset (portfolio)

Use **one region** (e.g. `ap-northeast-1` / Tokyo or `us-east-1`). Prefer:

- RDS: `db.t4g.micro`, single-AZ, 20 GB gp3
- Fargate: 0.25 vCPU / 512 MB, **1 task** while learning
- NAT Gateway is the expensive piece — see §2 for a cheaper first path

Estimate rough monthly cost for a always-on small stack: tens of USD (NAT + RDS dominate). Tear down when idle.

### Gaps closed in the repo

| Item | Status |
|------|--------|
| `backend/Dockerfile` + `.dockerignore` | Added |
| API entry `dist/server.js` | `CMD ["node", "dist/server.js"]` |
| `ENABLE_CRON` | Defaults on in development, off in production/test unless set |
| Expire job entrypoint | `node dist/jobs/expireIncompleteJourneys.js` (`npm run job:expire`) |

Production API task env:

```text
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://...@rds-endpoint:5432/transport_abt
JWT_SECRET=<long random>
MAX_JOURNEY_DURATION_HOURS=4
ENABLE_CRON=false
```

---

## 1. Decide region, names, and DNS

1. Pick a region, e.g. `ap-northeast-1`.
2. Pick resource prefixes, e.g. `transitpay-prod`.
3. Optional: register/use domain `transport.example.com` in Route 53.

Export helpers for the rest of this guide:

```bash
export AWS_REGION=ap-northeast-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export PREFIX=transitpay-prod
```

---

## 2. Networking (VPC)

### Recommended layout

```text
VPC 10.0.0.0/16
├── Public subnets (2 AZs)     → ALB (+ optional NAT)
├── Private app subnets (2 AZs) → ECS tasks
└── Private DB subnets (2 AZs)  → RDS (no public access)
```

### Practical first deploy (two options)

**Option A — Correct / production-like (recommended when you can afford NAT)**

1. Create VPC with **2 public + 2 private** subnets across 2 AZs.
2. Internet Gateway on public subnets.
3. **NAT Gateway** (1 is enough for portfolio) so private ECS can pull ECR images and talk to Secrets Manager / CloudWatch.
4. Place ALB in public subnets; ECS in private; RDS in private DB subnets.

**Option B — Cheaper learning path**

1. Put ECS tasks in **public** subnets with public IPs enabled (still lock security groups).
2. Skip NAT Gateway.
3. Keep RDS **private** (or temporarily public with SG locked to your IP only — not ideal; prefer private + bastion/SSM).

Use the VPC wizard (“VPC and more”) or Terraform/CDK later. Record:

- VPC ID
- Public subnet IDs (ALB)
- App subnet IDs (ECS)
- DB subnet IDs (RDS)

### Security groups (create empty, wire rules next)

| SG | Inbound | Outbound |
|----|---------|----------|
| `sg-alb` | 443 from `0.0.0.0/0` (and 80 if you redirect) | to ECS SG on 3000 |
| `sg-ecs` | 3000 **only from** `sg-alb` | HTTPS 443 (ECR/Secrets/CW), 5432 to RDS |
| `sg-rds` | 5432 **only from** `sg-ecs` | none needed |

Never open RDS to `0.0.0.0/0`.

---

## 3. RDS PostgreSQL

1. Create subnet group using **private DB subnets**.
2. Create RDS PostgreSQL **16** (matches local `postgres:16-alpine`).
3. Settings for portfolio:
   - Instance: `db.t4g.micro`
   - Storage: 20 GB gp3
   - Single-AZ
   - **Not** publicly accessible
   - DB name: `transport_abt` (or create empty DB and create schema later)
   - Master user/password → store in Secrets Manager immediately
4. Attach `sg-rds`.
5. Note the endpoint: `transitpay-xxxx.region.rds.amazonaws.com`.

Connection string shape (matches `backend/.env.example`):

```text
postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/transport_abt
```

### Create DB if the instance default DB is different

From a one-off ECS task or bastion with `psql`:

```sql
CREATE DATABASE transport_abt;
```

(Local Docker also creates `transport_abt_test` — not required in AWS.)

---

## 4. Containerize the backend

### 4.1 `backend/Dockerfile`

Already in the repo (multi-stage; entry is `server.js`). Summary:

```dockerfile
# builder: npm ci && npm run build
# runtime: npm ci --omit=dev + drizzle-kit for one-off migrate
# CMD ["node", "dist/server.js"]
```

`backend/.dockerignore` excludes `node_modules`, tests, and `.env`.

### 4.2 Local smoke

```bash
cd backend
docker build -t transitpay-api:local .
docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL='postgresql://...' \
  -e JWT_SECRET='test-secret-at-least-16' \
  transitpay-api:local
curl http://localhost:3000/api/health
```

### 4.3 ECR repository + push

```bash
aws ecr create-repository --repository-name ${PREFIX}-api --region $AWS_REGION

aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

docker tag transitpay-api:local ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PREFIX}-api:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PREFIX}-api:latest
```

---

## 5. Secrets Manager

Create secrets (do not put these in the image or git):

```bash
# Example: store JSON
aws secretsmanager create-secret \
  --name ${PREFIX}/app \
  --secret-string '{
    "DATABASE_URL":"postgresql://USER:PASS@RDS:5432/transport_abt",
    "JWT_SECRET":"REPLACE_WITH_LONG_RANDOM"
  }'
```

ECS task definition will map:

- `DATABASE_URL` ← secret key `DATABASE_URL`
- `JWT_SECRET` ← secret key `JWT_SECRET`

Also set plain env (non-secret):

- `PORT=3000`
- `NODE_ENV=production`
- `MAX_JOURNEY_DURATION_HOURS=4`
- `ENABLE_CRON=false`

---

## 6. IAM roles for ECS

Create two roles:

1. **Task execution role** (`ecsTaskExecutionRole`-style)
   - Pull from ECR
   - Write CloudWatch Logs
   - Read Secrets Manager (`${PREFIX}/app`)

2. **Task role** (app permissions)
   - Minimal for v1 (often empty)
   - Later: SQS, etc.

Attach AWS managed policies as needed:

- `AmazonECSTaskExecutionRolePolicy`
- Custom policy allowing `secretsmanager:GetSecretValue` on your secret ARN

---

## 7. ECS cluster, task definition, service + ALB

### 7.1 Cluster

```bash
aws ecs create-cluster --cluster-name ${PREFIX}
```

### 7.2 CloudWatch log group

```bash
aws logs create-log-group --log-group-name /ecs/${PREFIX}-api
```

### 7.3 Task definition (API)

- Family: `${PREFIX}-api`
- Launch type: **Fargate**
- CPU/memory: `256` / `512`
- Container:
  - Image: ECR URI `:latest` (or git SHA tag)
  - Port mapping: `3000`
  - Env + secrets as above
  - Log driver: `awslogs` → `/ecs/${PREFIX}-api`
- **Health check** (container or ALB): `GET /api/health`

Important: with `ENABLE_CRON=false`, API tasks must **not** run `node-cron` when you scale to >1 task.

### 7.4 Application Load Balancer

1. Create **internet-facing** ALB in public subnets; SG = `sg-alb`.
2. Target group:
   - Type: IP (Fargate)
   - Protocol HTTP :3000
   - Health check path: `/api/health`
   - Healthy threshold: 2
3. Listener:
   - Prefer **HTTPS :443** with ACM cert (see §9)
   - Temporary: HTTP :80 → target group (OK for first bring-up)

### 7.5 ECS service

- Cluster: `${PREFIX}`
- Task definition: `${PREFIX}-api`
- Desired count: **1**
- Subnets: private app (or public if Option B)
- Security group: `sg-ecs`
- Load balancer: attach target group on container port 3000
- Assign public IP: `ENABLED` only if tasks are in public subnets without NAT

Wait until target group shows **healthy**, then:

```bash
curl https://YOUR_ALB_DNS/api/health
# or http://...
```

---

## 8. Migrations, seed, and the expire job

### 8.1 Run migrations once (never on every API start)

From your laptop (with VPN/bastion/`psql` path to RDS) **or** a one-off ECS task:

```bash
# One-off ECS override example (conceptually):
# command: ["npx", "drizzle-kit", "migrate"]
# same image + DATABASE_URL secret
```

Local equivalent against RDS (if network allows):

```bash
cd backend
DATABASE_URL='postgresql://...' npx drizzle-kit migrate
```

### 8.2 Seed demo data (optional)

```bash
DATABASE_URL='postgresql://...' npm run db:seed
```

Demo users: `demo@example.com` / `student@example.com` · `password123`

### 8.3 Incomplete-journey job (production)

**Problem:** Running `node-cron` inside every API task duplicates expire work when `desiredCount > 1`.

**Repo support:**

1. API tasks: `ENABLE_CRON=false` (default when `NODE_ENV=production`).
2. Job entrypoint: `backend/src/jobs/expireIncompleteJourneys.ts` →

```text
node dist/jobs/expireIncompleteJourneys.js
# or: npm run job:expire
```

**AWS wiring:**

1. Task definition `${PREFIX}-expire` (same image, no ALB, same secrets).
2. Container command override: `["node","dist/jobs/expireIncompleteJourneys.js"]`
3. EventBridge Scheduler: every 5 minutes → Run ECS Task (`${PREFIX}-expire`) in the same subnets/SG as the API (RDS access required).
4. API service keeps `ENABLE_CRON=false`.

Local still uses cron when `NODE_ENV=development` (or `ENABLE_CRON=true`).

---

## 9. Frontend → S3 + CloudFront (same origin `/api`)

Frontend already uses `const BASE = '/api'` (`frontend/src/api.ts`). Keep that; CloudFront will split paths.

### 9.1 Build

```bash
cd frontend
npm ci
npm run build
# produces frontend/dist/ with index.html, dashboard.html, assets/, ...
```

### 9.2 S3 bucket

```bash
aws s3 mb s3://${PREFIX}-web --region $AWS_REGION
# Block all public access ON (CloudFront OAC will read it)
aws s3 sync dist/ s3://${PREFIX}-web/ --delete
```

### 9.3 ACM certificate

- If using CloudFront custom domain: request cert in **`us-east-1`** (CloudFront requirement).
- Validate via DNS (Route 53).

### 9.4 CloudFront distribution

Origins:

1. **S3** (via Origin Access Control) — default
2. **ALB** — for API

Behaviors:

| Path pattern | Origin | Notes |
|--------------|--------|-------|
| `/api/*` | ALB | HTTPS to ALB; forward headers needed for Host if ALB host-based; cache policy **CachingDisabled** |
| Default `*` | S3 | Cache static assets; HTML shorter TTL |

Viewer protocol: redirect HTTP→HTTPS.

**MPA note:** this app uses real paths like `/dashboard.html`, `/tap.html`. After sync, those objects exist in S3 — no SPA fallback required. Prefer linking with `.html` as the app already does.

### 9.5 DNS

Route 53 A/AAAA alias → CloudFront distribution.

Result:

```text
https://transport.example.com/           → S3
https://transport.example.com/api/health → ALB → ECS
```

No CORS headaches for browser calls to `/api`.

### 9.6 Invalidate on deploy

```bash
aws cloudfront create-invalidation --distribution-id E123 --paths "/*"
```

---

## 10. End-to-end smoke test

1. Open `https://your-domain/` → login page.
2. Login `demo@example.com` / `password123`.
3. Dashboard shows balance + media token.
4. Tap ENTRY `VAL-CENTRAL-ENTRY-01` → EXIT `VAL-RIVERSIDE-EXIT-01`.
5. Journey fare + wallet ledger update.
6. (Optional) Trigger expire job via EventBridge or `POST /api/admin/jobs/expire-journeys` on the student OPEN journey.

API-only check:

```bash
curl -s https://your-domain/api/health
curl -s -X POST https://your-domain/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"password123"}'
```

---

## 11. Observability

1. CloudWatch Logs: `/ecs/${PREFIX}-api` (and expire task group).
2. ALB metrics: `HTTPCode_Target_5XX_Count`, `TargetResponseTime`.
3. ECS: CPU/memory utilization.
4. RDS: CPU, free storage, connections.
5. Alarms (start simple): ALB 5xx > 0 for 5 minutes; unhealthy hosts > 0.

Prefer JSON logs later (`journeyId`, `accountId`, `event`).

---

## 12. CI/CD (GitHub Actions sketch)

You already have test CI (`.github/workflows/backend-ci.yml`). Extend for deploy:

### Backend job (on `main`)

```text
npm ci → npm test → npm run build
→ docker build → push ECR (tag = git sha)
→ (optional) run migrate task
→ update ECS service to new task definition
```

### Frontend job

```text
npm ci → npm run build
→ aws s3 sync frontend/dist s3://bucket
→ cloudfront invalidate
```

Store in GitHub Actions secrets:

- `AWS_ROLE_ARN` (OIDC preferred) or access keys
- No need to store `JWT_SECRET` in GitHub if only AWS Secrets Manager holds it

---

## 13. Ordered checklist (copy/paste)

- [ ] §0 Install CLI/Docker; note repo gaps (Dockerfile, cron flag)
- [ ] §1 Region + naming
- [ ] §2 VPC + subnets + SGs
- [ ] §3 RDS Postgres 16 + `transport_abt` + secret
- [ ] §4 Dockerfile + ECR push
- [ ] §5 Secrets Manager
- [ ] §6 ECS IAM roles
- [ ] §7 Cluster + task + ALB + service; `/api/health` green
- [ ] §8 Migrate (+ seed); EventBridge expire job (or single-task cron temporarily)
- [ ] §9 Build frontend → S3 → CloudFront `/api/*` → ALB
- [ ] §10 Browser smoke (login → tap → fare → ledger)
- [ ] §11 CloudWatch alarms
- [ ] §12 Optional: wire GitHub deploy workflows

---

## 14. Tear-down (save money)

Delete in reverse dependency order:

1. CloudFront distribution (disable then delete)
2. S3 objects + bucket
3. ECS service (desired 0) → delete service → delete cluster
4. ALB + target group
5. ECR images (optional)
6. RDS instance (final snapshot optional)
7. Secrets
8. NAT Gateway / Elastic IP (if any)
9. VPC

---

## 15. What to avoid (from the architecture guide)

| Avoid | Why |
|-------|-----|
| API Gateway in front of ALB | Extra hop; not needed |
| Lambda for tap→fare→wallet | Breaks one Postgres transaction |
| Auto-migrate on every task boot | Race on multi-task deploys |
| Cron inside every API task | Duplicate expire runs |
| Public RDS | Data exposure risk |
| Redis for v1 | Unused by current ABT code |

---

## 16. Production env checklist

Confirm before go-live:

1. `backend/Dockerfile` builds and `GET /api/health` works
2. ECS API: `NODE_ENV=production`, `ENABLE_CRON=false`
3. EventBridge → `node dist/jobs/expireIncompleteJourneys.js`
4. Secrets only in Secrets Manager (not image/git)
5. Frontend `dist/` synced to S3; CloudFront `/api/*` → ALB

---

## References

- Architecture rationale: [`cloud_infrastructure_guide.md`](../cloud_infrastructure_guide.md)
- Local run / demo users: [`README.md`](../README.md)
- API routes: [`docs/API.md`](API.md)
