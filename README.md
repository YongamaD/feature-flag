# Feature Flag Platform

A production-ready feature flag system with rule-based targeting, percentage rollouts, deterministic sticky assignments, and multi-tenant support.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│  Client SDK  │────▶│  Fastify API  │────▶│ Postgres │
│  (in-memory  │     │              │     └──────────┘
│  evaluation) │     │  /snapshot   │────▶┌──────────┐
└─────────────┘     │  /evaluate   │     │  Redis   │
                    │  /admin/*    │     └──────────┘
                    └──────────────┘
```

**Read path:** SDK → `/v1/flags/snapshot` → Redis cache → Postgres fallback
**Write path:** Admin API → Postgres transaction → new version → invalidate Redis

## Quick Start

```bash
# Start Postgres + Redis
pnpm docker:up

# Install dependencies
pnpm install

# Run migrations
pnpm db:migrate

# Seed demo data
pnpm db:seed

# Start the API server
pnpm dev
```

## Project Structure

```
feature-flags/
├── apps/api/             # Fastify API server
│   └── src/
│       ├── routes/       # Admin + public endpoints
│       ├── middleware/    # Auth (JWT + API key), error handling
│       ├── services/     # Business logic + caching
│       └── plugins/      # Prisma + Redis Fastify plugins
├── packages/
│   ├── evaluator/        # Core flag evaluation engine
│   │   └── src/
│   │       ├── evaluate.ts  # Main evaluation logic
│   │       ├── rules.ts     # Condition matching (EQ, IN, GT, etc.)
│   │       ├── rollout.ts   # Percentage rollout logic
│   │       └── hash.ts      # MurmurHash3 for deterministic bucketing
│   └── sdk/              # TypeScript client SDK
│       └── src/
│           └── client.ts    # FeatureFlagClient with auto-refresh
├── prisma/               # Schema + migrations + seed
├── infrastructure/       # Docker Compose
└── .github/workflows/    # CI pipeline
```

## API Reference

### Public Endpoints (SDK-facing)

Require `Authorization: Bearer <ENV_API_KEY>` header.

#### GET /v1/flags/snapshot

Returns all flags for the environment. Supports ETag/If-None-Match for caching.

```json
{
  "environmentId": "...",
  "version": 12,
  "flags": {
    "new-checkout": { "enabled": true, "defaultVariant": "control", ... },
    "beta-ui": { "enabled": false, ... }
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

Require `Authorization: Bearer <JWT>` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/admin/auth/login` | Get JWT token |
| POST | `/v1/admin/flags` | Create flag |
| GET | `/v1/admin/flags?environmentId=...` | List flags |
| GET | `/v1/admin/flags/:key?environmentId=...` | Get flag + versions |
| PUT | `/v1/admin/flags/:key` | Update draft state |
| POST | `/v1/admin/flags/:key/publish` | Publish new version |
| POST | `/v1/admin/flags/:key/rollback/:version` | Rollback to version |
| GET | `/v1/admin/audit?environmentId=...` | Query audit logs |
| POST | `/v1/admin/environments` | Create environment |

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
pnpm test          # Run all tests
pnpm test:watch    # Watch mode
```

## Technology Stack

- **Runtime:** Node.js 20+ / TypeScript
- **Framework:** Fastify 5
- **Database:** PostgreSQL 16 (Prisma ORM)
- **Cache:** Redis 7
- **Auth:** JWT (admin) + hashed API keys (SDK)
- **Validation:** Zod
- **Testing:** Vitest
