import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import autocannon from "autocannon";
import { createHash } from "crypto";
import { errorHandler } from "../src/middleware/error-handler.js";

// Route imports
import snapshotRoutes from "../src/routes/public/snapshot.js";
import evaluateRoutes from "../src/routes/public/evaluate.js";

// ── Constants ──────────────────────────────────────────────

const TEST_ENV_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_API_KEY = "ff_perftest_key";
const TEST_API_KEY_HASH = createHash("sha256")
  .update(TEST_API_KEY)
  .digest("hex");

const SAMPLE_STATE = {
  enabled: true,
  defaultVariant: "control",
  variants: ["control", "treatment"],
  rules: [
    {
      id: "rule-1",
      conditions: [{ attr: "country", op: "EQ", value: "ZA" }],
      result: { enabled: true, variant: "treatment" },
    },
  ],
  rollout: null,
};

const SNAPSHOT = {
  environmentId: TEST_ENV_ID,
  version: 1,
  flags: {
    "new-checkout": SAMPLE_STATE,
  },
};

// ── Test Server Setup ──────────────────────────────────────

let app: FastifyInstance;
let baseUrl: string;

function createMockRedis() {
  const store = new Map<string, string>();
  store.set(`env:${TEST_ENV_ID}:snapshot`, JSON.stringify(SNAPSHOT));
  store.set(`env:${TEST_ENV_ID}:version`, "1");

  return {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    },
    del: async (...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (store.delete(key)) count++;
      }
      return count;
    },
    disconnect: () => {},
    connect: () => {},
  };
}

function createMockPrisma() {
  return {
    environment: {
      findFirst: async (args: any) => {
        if (args?.where?.apiKeyHash === TEST_API_KEY_HASH) {
          return { id: TEST_ENV_ID };
        }
        return null;
      },
    },
    flag: {
      findUnique: async () => null,
      findMany: async () => [],
    },
    $connect: async () => {},
    $disconnect: async () => {},
  };
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.decorate("prisma", createMockPrisma());
  app.decorate("redis", createMockRedis());

  await app.register(snapshotRoutes);
  await app.register(evaluateRoutes);

  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  baseUrl = address;
});

afterAll(async () => {
  await app.close();
});

// ── Helper ─────────────────────────────────────────────────

function runAutocannon(opts: autocannon.Options): Promise<autocannon.Result> {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// ── Performance Tests ──────────────────────────────────────

describe("Performance: GET /v1/flags/snapshot", () => {
  it("handles sustained load with acceptable latency", async () => {
    const result = await runAutocannon({
      url: `${baseUrl}/v1/flags/snapshot`,
      connections: 50,
      duration: 5,
      headers: {
        authorization: `Bearer ${TEST_API_KEY}`,
      },
    });

    console.log("\n--- Snapshot Endpoint Performance ---");
    console.log(`  Requests/sec: ${result.requests.average}`);
    console.log(`  Latency p50:  ${result.latency.p50}ms`);
    console.log(`  Latency p99:  ${result.latency.p99}ms`);
    console.log(`  Throughput:   ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
    console.log(`  Errors:       ${result.errors}`);
    console.log(`  Timeouts:     ${result.timeouts}`);
    console.log(`  Total reqs:   ${result.requests.total}`);

    // Thresholds
    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    expect(result.latency.p99).toBeLessThan(200); // p99 under 200ms
    expect(result.requests.average).toBeGreaterThan(500); // at least 500 req/s
  }, 30_000);
});

describe("Performance: POST /v1/evaluate", () => {
  it("handles sustained load with acceptable latency", async () => {
    const result = await runAutocannon({
      url: `${baseUrl}/v1/evaluate`,
      method: "POST",
      connections: 50,
      duration: 5,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TEST_API_KEY}`,
      },
      body: JSON.stringify({
        flagKey: "new-checkout",
        context: { country: "ZA", userId: "user-123" },
      }),
    });

    console.log("\n--- Evaluate Endpoint Performance ---");
    console.log(`  Requests/sec: ${result.requests.average}`);
    console.log(`  Latency p50:  ${result.latency.p50}ms`);
    console.log(`  Latency p99:  ${result.latency.p99}ms`);
    console.log(`  Throughput:   ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
    console.log(`  Errors:       ${result.errors}`);
    console.log(`  Timeouts:     ${result.timeouts}`);
    console.log(`  Total reqs:   ${result.requests.total}`);

    // Thresholds
    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    expect(result.latency.p99).toBeLessThan(200); // p99 under 200ms
    expect(result.requests.average).toBeGreaterThan(500); // at least 500 req/s
  }, 30_000);
});
