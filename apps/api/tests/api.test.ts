import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { errorHandler } from "../src/middleware/error-handler.js";

// Route imports
import authRoutes from "../src/routes/admin/auth.js";
import environmentRoutes from "../src/routes/admin/environments.js";
import flagRoutes from "../src/routes/admin/flags.js";
import publishRoutes from "../src/routes/admin/publish.js";
import auditRoutes from "../src/routes/admin/audit.js";
import snapshotRoutes from "../src/routes/public/snapshot.js";
import evaluateRoutes from "../src/routes/public/evaluate.js";

// ── Constants ──────────────────────────────────────────────

const JWT_SECRET = "test-secret";
process.env.JWT_SECRET = JWT_SECRET;

const TEST_ENV_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_PROJECT_ID = "660e8400-e29b-41d4-a716-446655440000";
const TEST_API_KEY = "ff_testkey123";
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

const DISABLED_STATE = {
  enabled: false,
  defaultVariant: "off",
  variants: ["off", "on"],
  rules: [],
  rollout: null,
};

// ── Helpers ────────────────────────────────────────────────

function createTestJwt(
  sub = "admin@example.com",
  role: "admin" | "editor" = "admin"
) {
  return jwt.sign({ sub, role }, JWT_SECRET, { expiresIn: "1h" });
}

function createMockPrisma() {
  return {
    environment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    flag: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    flagVersion: {
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
}

function createMockRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (store.delete(key)) count++;
      }
      return count;
    }),
    disconnect: vi.fn(),
    connect: vi.fn(),
    _store: store,
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;
type MockRedis = ReturnType<typeof createMockRedis>;

async function buildTestApp(mockPrisma: MockPrisma, mockRedis: MockRedis) {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.decorate("prisma", mockPrisma);
  app.decorate("redis", mockRedis);

  await app.register(authRoutes);
  await app.register(environmentRoutes);
  await app.register(flagRoutes);
  await app.register(publishRoutes);
  await app.register(auditRoutes);
  await app.register(snapshotRoutes);
  await app.register(evaluateRoutes);

  await app.ready();
  return app;
}

function seedApiKeyAuth(mockPrisma: MockPrisma) {
  mockPrisma.environment.findFirst.mockImplementation(async (args: any) => {
    if (args?.where?.apiKeyHash === TEST_API_KEY_HASH) {
      return { id: TEST_ENV_ID };
    }
    return null;
  });
}

function seedSnapshot(mockRedis: MockRedis, version = 3) {
  const snapshot = {
    environmentId: TEST_ENV_ID,
    version,
    flags: {
      "new-checkout": SAMPLE_STATE,
      "disabled-flag": DISABLED_STATE,
    },
  };
  mockRedis._store.set(
    `env:${TEST_ENV_ID}:snapshot`,
    JSON.stringify(snapshot)
  );
  mockRedis._store.set(`env:${TEST_ENV_ID}:version`, String(version));
  return snapshot;
}

// ── Tests ──────────────────────────────────────────────────

let app: FastifyInstance;
let mockPrisma: MockPrisma;
let mockRedis: MockRedis;

beforeEach(async () => {
  mockPrisma = createMockPrisma();
  mockRedis = createMockRedis();
  app = await buildTestApp(mockPrisma, mockRedis);
});

afterEach(async () => {
  await app.close();
});

// ── Snapshot Endpoint ──────────────────────────────────────

describe("GET /v1/flags/snapshot", () => {
  it("returns 401 for missing Authorization header", async () => {
    const res = await supertest(app.server).get("/v1/flags/snapshot");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Missing or invalid Authorization header");
  });

  it("returns 401 for invalid API key", async () => {
    mockPrisma.environment.findFirst.mockResolvedValue(null);

    const res = await supertest(app.server)
      .get("/v1/flags/snapshot")
      .set("Authorization", "Bearer ff_bad_key");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid API key");
  });

  it("returns snapshot from cache (HIT) with ETag", async () => {
    seedApiKeyAuth(mockPrisma);
    const snapshot = seedSnapshot(mockRedis, 5);

    const res = await supertest(app.server)
      .get("/v1/flags/snapshot")
      .set("Authorization", `Bearer ${TEST_API_KEY}`);

    expect(res.status).toBe(200);
    expect(res.headers["x-cache"]).toBe("HIT");
    expect(res.headers.etag).toBe('"v5"');
    expect(res.body).toEqual(snapshot);
  });

  it("returns 304 Not Modified when If-None-Match matches", async () => {
    seedApiKeyAuth(mockPrisma);
    seedSnapshot(mockRedis, 5);

    const res = await supertest(app.server)
      .get("/v1/flags/snapshot")
      .set("Authorization", `Bearer ${TEST_API_KEY}`)
      .set("If-None-Match", '"v5"');

    expect(res.status).toBe(304);
  });

  it("returns snapshot from DB on cache miss (MISS)", async () => {
    seedApiKeyAuth(mockPrisma);

    mockPrisma.flag.findMany.mockResolvedValue([
      {
        id: "flag-1",
        key: "new-checkout",
        environmentId: TEST_ENV_ID,
        isArchived: false,
        versions: [{ version: 2, stateJson: SAMPLE_STATE }],
      },
    ]);

    const res = await supertest(app.server)
      .get("/v1/flags/snapshot")
      .set("Authorization", `Bearer ${TEST_API_KEY}`);

    expect(res.status).toBe(200);
    expect(res.headers["x-cache"]).toBe("MISS");
    expect(res.body.flags["new-checkout"]).toEqual(SAMPLE_STATE);
    expect(mockRedis.set).toHaveBeenCalled();
  });
});

// ── Evaluate Endpoint ──────────────────────────────────────

describe("POST /v1/evaluate", () => {
  it("returns 401 for invalid API key", async () => {
    mockPrisma.environment.findFirst.mockResolvedValue(null);

    const res = await supertest(app.server)
      .post("/v1/evaluate")
      .set("Authorization", "Bearer ff_bad")
      .send({ flagKey: "new-checkout", context: {} });

    expect(res.status).toBe(401);
  });

  it("evaluates flag from cached snapshot (rule match)", async () => {
    seedApiKeyAuth(mockPrisma);
    seedSnapshot(mockRedis);

    const res = await supertest(app.server)
      .post("/v1/evaluate")
      .set("Authorization", `Bearer ${TEST_API_KEY}`)
      .send({ flagKey: "new-checkout", context: { country: "ZA" } });

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.variant).toBe("treatment");
    expect(res.body.reason).toBe("RULE_MATCH");
  });

  it("falls back to DB when cache is empty", async () => {
    seedApiKeyAuth(mockPrisma);

    mockPrisma.flag.findUnique.mockResolvedValue({
      id: "flag-1",
      key: "new-checkout",
      environmentId: TEST_ENV_ID,
      versions: [{ version: 1, stateJson: SAMPLE_STATE }],
    });

    const res = await supertest(app.server)
      .post("/v1/evaluate")
      .set("Authorization", `Bearer ${TEST_API_KEY}`)
      .send({ flagKey: "new-checkout", context: { country: "ZA" } });

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.reason).toBe("RULE_MATCH");
  });

  it("returns 404 for non-existent flag", async () => {
    seedApiKeyAuth(mockPrisma);
    mockPrisma.flag.findUnique.mockResolvedValue(null);

    const res = await supertest(app.server)
      .post("/v1/evaluate")
      .set("Authorization", `Bearer ${TEST_API_KEY}`)
      .send({ flagKey: "nonexistent", context: {} });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Flag not found");
  });

  it("returns disabled for disabled flag", async () => {
    seedApiKeyAuth(mockPrisma);
    seedSnapshot(mockRedis);

    const res = await supertest(app.server)
      .post("/v1/evaluate")
      .set("Authorization", `Bearer ${TEST_API_KEY}`)
      .send({ flagKey: "disabled-flag", context: {} });

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.reason).toBe("DISABLED");
  });
});

// ── Flag CRUD ──────────────────────────────────────────────

describe("POST /v1/admin/flags", () => {
  it("creates a flag and returns 201", async () => {
    const createdFlag = {
      id: "flag-1",
      key: "my-flag",
      description: "",
      environmentId: TEST_ENV_ID,
      isArchived: false,
      versions: [{ id: "v-1", version: 1, stateJson: SAMPLE_STATE }],
    };
    mockPrisma.flag.create.mockResolvedValue(createdFlag);
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const res = await supertest(app.server)
      .post("/v1/admin/flags")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({
        key: "my-flag",
        environmentId: TEST_ENV_ID,
        initialState: SAMPLE_STATE,
      });

    expect(res.status).toBe(201);
    expect(res.body.key).toBe("my-flag");
  });

  it("returns 400 for invalid flag key format", async () => {
    const res = await supertest(app.server)
      .post("/v1/admin/flags")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({
        key: "Invalid_Key!",
        environmentId: TEST_ENV_ID,
        initialState: SAMPLE_STATE,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("returns 400 when missing required fields", async () => {
    const res = await supertest(app.server)
      .post("/v1/admin/flags")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});

describe("GET /v1/admin/flags", () => {
  it("lists flags for an environment", async () => {
    const flags = [
      {
        id: "flag-1",
        key: "my-flag",
        versions: [{ version: 1, stateJson: SAMPLE_STATE }],
      },
    ];
    mockPrisma.flag.findMany.mockResolvedValue(flags);

    const res = await supertest(app.server)
      .get(`/v1/admin/flags?environmentId=${TEST_ENV_ID}`)
      .set("Authorization", `Bearer ${createTestJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(flags);
  });

  it("returns 400 for missing environmentId", async () => {
    const res = await supertest(app.server)
      .get("/v1/admin/flags")
      .set("Authorization", `Bearer ${createTestJwt()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});

describe("GET /v1/admin/flags/:key", () => {
  it("returns flag with versions", async () => {
    const flag = {
      id: "flag-1",
      key: "my-flag",
      versions: [
        { version: 2, stateJson: SAMPLE_STATE },
        { version: 1, stateJson: DISABLED_STATE },
      ],
    };
    mockPrisma.flag.findUnique.mockResolvedValue(flag);

    const res = await supertest(app.server)
      .get(`/v1/admin/flags/my-flag?environmentId=${TEST_ENV_ID}`)
      .set("Authorization", `Bearer ${createTestJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body.key).toBe("my-flag");
    expect(res.body.versions).toHaveLength(2);
  });

  it("returns 404 for non-existent flag", async () => {
    mockPrisma.flag.findUnique.mockResolvedValue(null);

    const res = await supertest(app.server)
      .get(`/v1/admin/flags/nope?environmentId=${TEST_ENV_ID}`)
      .set("Authorization", `Bearer ${createTestJwt()}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Flag not found");
  });
});

describe("PUT /v1/admin/flags/:key", () => {
  it("updates draft state and returns 200", async () => {
    const updatedVersion = {
      id: "v-1",
      version: 1,
      stateJson: DISABLED_STATE,
    };
    mockPrisma.flag.findUnique.mockResolvedValue({
      id: "flag-1",
      key: "my-flag",
      versions: [{ id: "v-1", version: 1, stateJson: SAMPLE_STATE }],
    });
    mockPrisma.flagVersion.update.mockResolvedValue(updatedVersion);
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const res = await supertest(app.server)
      .put("/v1/admin/flags/my-flag")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({ environmentId: TEST_ENV_ID, stateJson: DISABLED_STATE });

    expect(res.status).toBe(200);
  });

  it("returns 404 when flag does not exist", async () => {
    mockPrisma.flag.findUnique.mockResolvedValue(null);

    const res = await supertest(app.server)
      .put("/v1/admin/flags/nope")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({ environmentId: TEST_ENV_ID, stateJson: DISABLED_STATE });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Flag not found");
  });
});

// ── Publish Endpoint ───────────────────────────────────────

describe("POST /v1/admin/flags/:key/publish", () => {
  it("returns 401 without valid JWT", async () => {
    const res = await supertest(app.server)
      .post("/v1/admin/flags/my-flag/publish")
      .send({ environmentId: TEST_ENV_ID });

    expect(res.status).toBe(401);
  });

  it("returns 404 when flag does not exist", async () => {
    mockPrisma.flag.findUnique.mockResolvedValue(null);

    const res = await supertest(app.server)
      .post("/v1/admin/flags/my-flag/publish")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({ environmentId: TEST_ENV_ID });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Flag not found");
  });

  it("publishes flag, creates new version, and invalidates cache", async () => {
    mockPrisma.flag.findUnique.mockResolvedValue({
      id: "flag-1",
      key: "my-flag",
      versions: [{ version: 1, stateJson: SAMPLE_STATE }],
    });

    const newVersion = {
      id: "v-2",
      version: 2,
      stateJson: SAMPLE_STATE,
      createdBy: "admin@example.com",
      createdAt: new Date().toISOString(),
    };
    mockPrisma.flagVersion.create.mockResolvedValue(newVersion);
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    // Seed cache so we can verify invalidation
    mockRedis._store.set(`env:${TEST_ENV_ID}:snapshot`, "cached");
    mockRedis._store.set(`env:${TEST_ENV_ID}:version`, "1");

    const res = await supertest(app.server)
      .post("/v1/admin/flags/my-flag/publish")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({ environmentId: TEST_ENV_ID });

    expect(res.status).toBe(200);
    expect(res.body.key).toBe("my-flag");
    expect(res.body.version).toBe(2);

    // Verify Redis cache was invalidated
    expect(mockRedis.del).toHaveBeenCalled();
    expect(mockRedis._store.has(`env:${TEST_ENV_ID}:snapshot`)).toBe(false);
  });
});

// ── Rollback Endpoint ──────────────────────────────────────

describe("POST /v1/admin/flags/:key/rollback/:version", () => {
  it("returns 400 for invalid version number", async () => {
    const res = await supertest(app.server)
      .post("/v1/admin/flags/my-flag/rollback/abc")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({ environmentId: TEST_ENV_ID });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid version number");
  });

  it("returns 404 when flag does not exist", async () => {
    mockPrisma.flag.findUnique.mockResolvedValue(null);

    const res = await supertest(app.server)
      .post("/v1/admin/flags/my-flag/rollback/1")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({ environmentId: TEST_ENV_ID });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Flag or version not found");
  });

  it("rolls back to target version, creates new version, invalidates cache", async () => {
    const v1State = DISABLED_STATE;
    const v2State = SAMPLE_STATE;

    mockPrisma.flag.findUnique.mockResolvedValue({
      id: "flag-1",
      key: "my-flag",
      versions: [
        { version: 2, stateJson: v2State },
        { version: 1, stateJson: v1State },
      ],
    });

    const newVersion = {
      id: "v-3",
      version: 3,
      stateJson: v1State,
      createdBy: "admin@example.com",
      createdAt: new Date().toISOString(),
    };
    mockPrisma.flagVersion.create.mockResolvedValue(newVersion);
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    mockRedis._store.set(`env:${TEST_ENV_ID}:snapshot`, "cached");

    const res = await supertest(app.server)
      .post("/v1/admin/flags/my-flag/rollback/1")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({ environmentId: TEST_ENV_ID });

    expect(res.status).toBe(200);
    expect(res.body.rolledBackToVersion).toBe(1);
    expect(res.body.newVersion).toBe(3);
    expect(mockRedis.del).toHaveBeenCalled();
  });
});

// ── Archive Endpoint ───────────────────────────────────────

describe("PATCH /v1/admin/flags/:key/archive", () => {
  it("archives a flag", async () => {
    const archivedFlag = {
      id: "flag-1",
      key: "my-flag",
      isArchived: true,
    };
    mockPrisma.flag.findUnique.mockResolvedValue({
      id: "flag-1",
      key: "my-flag",
      isArchived: false,
    });
    mockPrisma.flag.update.mockResolvedValue(archivedFlag);
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const res = await supertest(app.server)
      .patch("/v1/admin/flags/my-flag/archive")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({ environmentId: TEST_ENV_ID });

    expect(res.status).toBe(200);
    expect(res.body.isArchived).toBe(true);
  });

  it("returns 404 for non-existent flag", async () => {
    mockPrisma.flag.findUnique.mockResolvedValue(null);

    const res = await supertest(app.server)
      .patch("/v1/admin/flags/nope/archive")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({ environmentId: TEST_ENV_ID });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Flag not found");
  });
});

describe("PATCH /v1/admin/flags/:key/unarchive", () => {
  it("unarchives a flag", async () => {
    const unarchivedFlag = {
      id: "flag-1",
      key: "my-flag",
      isArchived: false,
    };
    mockPrisma.flag.findUnique.mockResolvedValue({
      id: "flag-1",
      key: "my-flag",
      isArchived: true,
    });
    mockPrisma.flag.update.mockResolvedValue(unarchivedFlag);
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const res = await supertest(app.server)
      .patch("/v1/admin/flags/my-flag/unarchive")
      .set("Authorization", `Bearer ${createTestJwt()}`)
      .send({ environmentId: TEST_ENV_ID });

    expect(res.status).toBe(200);
    expect(res.body.isArchived).toBe(false);
  });
});

// ── Environment Endpoints ──────────────────────────────────

describe("GET /v1/admin/environments", () => {
  it("lists environments without exposing apiKeyHash", async () => {
    const envs = [
      {
        id: TEST_ENV_ID,
        name: "development",
        projectId: TEST_PROJECT_ID,
        createdAt: new Date().toISOString(),
      },
    ];
    mockPrisma.environment.findMany.mockResolvedValue(envs);

    const res = await supertest(app.server)
      .get(`/v1/admin/environments?projectId=${TEST_PROJECT_ID}`)
      .set("Authorization", `Bearer ${createTestJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(envs);
    expect(res.body[0]).not.toHaveProperty("apiKeyHash");
  });

  it("returns 400 for missing projectId", async () => {
    const res = await supertest(app.server)
      .get("/v1/admin/environments")
      .set("Authorization", `Bearer ${createTestJwt()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});

// ── Audit Endpoint ─────────────────────────────────────────

describe("GET /v1/admin/audit", () => {
  it("returns paginated audit logs", async () => {
    const logs = [
      {
        id: "log-1",
        environmentId: TEST_ENV_ID,
        actor: "admin@example.com",
        action: "PUBLISH",
        entityKey: "my-flag",
        diffJson: { version: 2 },
        createdAt: new Date().toISOString(),
      },
    ];
    mockPrisma.auditLog.findMany.mockResolvedValue(logs);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const res = await supertest(app.server)
      .get(`/v1/admin/audit?environmentId=${TEST_ENV_ID}`)
      .set("Authorization", `Bearer ${createTestJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(logs);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
    });
  });

  it("returns 400 for missing environmentId", async () => {
    const res = await supertest(app.server)
      .get("/v1/admin/audit")
      .set("Authorization", `Bearer ${createTestJwt()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});

// ── Auth Endpoint ──────────────────────────────────────────

describe("POST /v1/admin/auth/login", () => {
  it("returns JWT for valid credentials", async () => {
    const res = await supertest(app.server)
      .post("/v1/admin/auth/login")
      .send({ email: "admin@example.com", password: "admin123" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.expiresIn).toBe(3600);
  });

  it("returns 401 for invalid credentials", async () => {
    const res = await supertest(app.server)
      .post("/v1/admin/auth/login")
      .send({ email: "admin@example.com", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });
});
