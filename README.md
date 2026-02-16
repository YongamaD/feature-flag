# Feature Flag Platform

A production-ready feature flag system with rule-based targeting, percentage rollouts, deterministic sticky assignments, multi-tenant support, and an admin dashboard.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────┐
│  Dashboard   │────▶│              │────▶│ Postgres │
│  (React SPA) │     │  Fastify API │     └──────────┘
└──────────────┘     │              │────▶┌──────────┐
┌──────────────┐     │  /snapshot   │     │  Redis   │
│  Client SDK  │────▶│  /evaluate   │     └──────────┘
│  (in-memory  │     │  /admin/*    │
│  evaluation) │     └──────────────┘
└──────────────┘
```

**Read path:** SDK → `/v1/flags/snapshot` → Redis cache → Postgres fallback
**Write path:** Dashboard → Admin API → Postgres transaction → new version → invalidate Redis

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for Postgres + Redis)

### 1. Clone and install

```bash
git clone https://github.com/YongamaD/feature-flag.git
cd feature-flag
pnpm install
```

### 2. Start infrastructure

```bash
pnpm docker:up    # Starts Postgres (port 5433) + Redis (port 6379)
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — update VITE_DEFAULT_PROJECT_ID after seeding
```

### 4. Set up the database

```bash
pnpm db:migrate   # Create tables
pnpm db:seed      # Seed demo data (prints API keys — save them!)
```

The seed creates:
- **Admin user:** `admin@example.com` / `admin123`
- **3 environments:** development, staging, production (with API keys)
- **3 demo flags:** `new-checkout`, `beta-ui`, `dark-mode`

### 5. Start the servers

```bash
# Terminal 1 — API server
pnpm dev              # http://localhost:3000

# Terminal 2 — Dashboard
pnpm dev:dashboard    # http://localhost:5173 (proxies /v1 to API)
```

### 6. Log in to the dashboard

Open http://localhost:5173 and log in with `admin@example.com` / `admin123`.

From the dashboard you can:
- Create, edit, and publish feature flags
- Toggle flags on/off
- Configure targeting rules and percentage rollouts
- Manage environments and view API keys
- Browse the audit log
- Register new users (admin only)

## Project Structure

```
feature-flags/
├── apps/
│   ├── api/                 # Fastify API server
│   │   ├── src/
│   │   │   ├── routes/      # Admin + public endpoints
│   │   │   ├── middleware/   # Auth (JWT + API key), error handling
│   │   │   ├── services/    # Business logic + caching
│   │   │   └── plugins/     # Prisma + Redis Fastify plugins
│   │   ├── tests/           # Integration + performance tests
│   │   └── Dockerfile
│   └── dashboard/           # React admin dashboard
│       ├── src/
│       │   ├── pages/       # Login, flags, environments, audit, users
│       │   ├── components/  # UI primitives, layout, flag editors
│       │   ├── context/     # Auth + environment providers
│       │   └── lib/         # API client, types, auth helpers
│       ├── Dockerfile
│       └── nginx.conf
├── packages/
│   ├── evaluator/           # Core flag evaluation engine
│   │   └── src/
│   │       ├── evaluate.ts  # Main evaluation logic
│   │       ├── rules.ts     # Condition matching (EQ, IN, GT, etc.)
│   │       ├── rollout.ts   # Percentage rollout logic
│   │       └── hash.ts      # MurmurHash3 for deterministic bucketing
│   └── sdk/                 # TypeScript client SDK
│       └── src/
│           └── client.ts    # FeatureFlagClient with auto-refresh
├── prisma/                  # Schema + migrations + seed
├── infrastructure/docker/   # Docker Compose (Postgres, Redis, API, Dashboard)
└── .github/workflows/       # CI pipeline
```

## API Reference

### Public Endpoints (SDK-facing)

Require `Authorization: Bearer <ENV_API_KEY>` header.

#### GET /v1/flags/snapshot

Returns all flags for the environment. Supports `ETag` / `If-None-Match` for caching.

```json
{
  "environmentId": "...",
  "version": 12,
  "flags": {
    "new-checkout": { "enabled": true, "defaultVariant": "control", "variants": ["control", "treatment"], "rules": [], "rollout": null },
    "beta-ui": { "enabled": false, "defaultVariant": "off", "variants": ["on", "off"], "rules": [], "rollout": null }
  }
}
```

#### POST /v1/evaluate

Evaluate a single flag against a user context.

```json
// Request
{ "flagKey": "new-checkout", "context": { "userId": "123", "country": "ZA" } }

// Response
{ "enabled": true, "variant": "treatment", "reason": "RULE_MATCH", "flagVersion": 3 }
```

### Admin Endpoints

Require `Authorization: Bearer <JWT>` header (obtained via login).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/admin/auth/login` | Get JWT token |
| POST | `/v1/admin/auth/register` | Create user (admin only) |
| POST | `/v1/admin/flags` | Create flag |
| GET | `/v1/admin/flags?environmentId=...` | List flags |
| GET | `/v1/admin/flags/:key?environmentId=...` | Get flag + version history |
| PUT | `/v1/admin/flags/:key` | Update draft state |
| PATCH | `/v1/admin/flags/:key/archive` | Archive flag |
| PATCH | `/v1/admin/flags/:key/unarchive` | Unarchive flag |
| POST | `/v1/admin/flags/:key/publish` | Publish new version |
| POST | `/v1/admin/flags/:key/rollback/:version` | Rollback to version |
| GET | `/v1/admin/environments?projectId=...` | List environments |
| POST | `/v1/admin/environments` | Create environment |
| GET | `/v1/admin/audit?environmentId=...` | Query audit logs (paginated) |

## Flag Configuration

```json
{
  "enabled": true,
  "defaultVariant": "control",
  "variants": ["control", "treatment"],
  "rules": [
    {
      "id": "rule-1",
      "conditions": [
        { "attr": "country", "op": "IN", "value": ["ZA", "NG"] },
        { "attr": "plan", "op": "EQ", "value": "pro" }
      ],
      "result": { "enabled": true, "variant": "treatment" }
    }
  ],
  "rollout": {
    "type": "PERCENT",
    "percentage": 25,
    "stickinessKey": "userId"
  }
}
```

**Evaluation order:** Disabled check → Rules (first match) → Rollout → Default

**Supported operators:** `EQ`, `NEQ`, `IN`, `NOT_IN`, `GT`, `LT`, `CONTAINS`

## SDK Usage

```typescript
import { FeatureFlagClient } from "@feature-flags/sdk";

const client = new FeatureFlagClient({
  envKey: "ff_your_api_key",
  baseUrl: "http://localhost:3000",
  refreshIntervalMs: 30000,
});

await client.init();

// Evaluate locally (no network per call)
if (client.isEnabled("new-checkout", { userId: "123", country: "ZA" })) {
  showNewCheckout();
}

const variant = client.getVariant("new-checkout", { userId: "123" });

client.close();
```

## Evaluation Engine

The evaluator is a standalone package (`@feature-flags/evaluator`) used by both the API and SDK:

- **Deterministic rollouts** via MurmurHash3: `bucket = hash(userId + flagKey) % 100`
- **Rule evaluation** with AND logic across conditions
- **Zero network calls** when used in the SDK (local evaluation from snapshot)

## Testing

```bash
pnpm test                # Run all 87 tests (unit + integration + perf)
pnpm test:watch          # Watch mode
```

### Test coverage

```bash
npx vitest run --coverage   # Generates HTML report in ./coverage/
```

Coverage includes unit tests for the evaluator, SDK client tests, API integration tests, and performance benchmarks.

### Performance tests

The perf suite uses [autocannon](https://github.com/mcollina/autocannon) to hit the API with 50 concurrent connections for 5 seconds per endpoint:

| Endpoint | Requests/sec | p99 Latency |
|----------|-------------|-------------|
| `GET /v1/flags/snapshot` | ~40k | ~2ms |
| `POST /v1/evaluate` | ~28k | ~3ms |

Thresholds enforced: p99 < 200ms, > 500 req/s, 0 errors.

## Docker

### Development (Postgres + Redis only)

```bash
pnpm docker:up     # Start Postgres (5433) + Redis (6379)
pnpm docker:down   # Stop containers
```

### Full stack (API + Dashboard + Postgres + Redis)

```bash
docker compose -f infrastructure/docker/docker-compose.yml --profile full up -d
```

| Service | Port | Description |
|---------|------|-------------|
| Postgres | 5433 | Database |
| Redis | 6379 | Cache |
| API | 3000 | Fastify server |
| Dashboard | 8080 | Nginx serving React SPA |

## CI Pipeline

GitHub Actions runs on every push/PR to `main` and can be triggered manually via `workflow_dispatch`.

Steps:
1. **Typecheck** — builds evaluator + API
2. **Build dashboard** — Vite production build
3. **Lint** — TypeScript `noEmit` across all packages
4. **Tests with coverage** — 87 tests, coverage report uploaded as artifact
5. **Performance tests** — autocannon benchmarks with threshold checks
6. **Migrations** — validates Prisma migrations apply cleanly

## Scripts Reference

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start API server (dev mode with watch) |
| `pnpm dev:dashboard` | Start dashboard dev server |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Typecheck all packages |
| `pnpm db:migrate` | Create/apply Prisma migrations |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `pnpm docker:up` | Start Postgres + Redis |
| `pnpm docker:down` | Stop Docker containers |

## Technology Stack

- **Runtime:** Node.js 20+ / TypeScript 5
- **API:** Fastify 5
- **Dashboard:** React 19, Vite 6, Tailwind CSS 4, React Router 7
- **Database:** PostgreSQL 16 (Prisma ORM)
- **Cache:** Redis 7
- **Auth:** JWT + bcrypt (admin), hashed API keys (SDK)
- **Validation:** Zod
- **Testing:** Vitest, autocannon
- **CI:** GitHub Actions (coverage + perf + migrations)
