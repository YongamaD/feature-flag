import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FeatureFlagClient } from "../src/client.js";
import type { Snapshot } from "../src/types.js";

const mockSnapshot: Snapshot = {
  environmentId: "env-1",
  version: 3,
  flags: {
    "new-checkout": {
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
    },
    "disabled-flag": {
      enabled: false,
      defaultVariant: "off",
      variants: ["off", "on"],
      rules: [],
      rollout: null,
    },
  },
};

function createMockFetch(snapshot: Snapshot = mockSnapshot) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(snapshot),
  });
}

describe("FeatureFlagClient", () => {
  let client: FeatureFlagClient;

  afterEach(() => {
    client?.close();
  });

  it("fetches snapshot on sync", async () => {
    const mockFetch = createMockFetch();
    client = new FeatureFlagClient(
      { envKey: "ff_test", baseUrl: "http://localhost:3000" },
      mockFetch as any
    );

    await client.sync();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/v1/flags/snapshot",
      { headers: { Authorization: "Bearer ff_test" } }
    );
    expect(client.getSnapshot()).toEqual(mockSnapshot);
  });

  it("isEnabled returns true for enabled flag", async () => {
    client = new FeatureFlagClient(
      { envKey: "ff_test", baseUrl: "http://localhost:3000" },
      createMockFetch() as any
    );
    await client.sync();

    expect(client.isEnabled("new-checkout", { userId: "1" })).toBe(true);
  });

  it("isEnabled returns false for disabled flag", async () => {
    client = new FeatureFlagClient(
      { envKey: "ff_test", baseUrl: "http://localhost:3000" },
      createMockFetch() as any
    );
    await client.sync();

    expect(client.isEnabled("disabled-flag")).toBe(false);
  });

  it("isEnabled returns false for unknown flag", async () => {
    client = new FeatureFlagClient(
      { envKey: "ff_test", baseUrl: "http://localhost:3000" },
      createMockFetch() as any
    );
    await client.sync();

    expect(client.isEnabled("nonexistent")).toBe(false);
  });

  it("getVariant returns matching variant for rule match", async () => {
    client = new FeatureFlagClient(
      { envKey: "ff_test", baseUrl: "http://localhost:3000" },
      createMockFetch() as any
    );
    await client.sync();

    expect(client.getVariant("new-checkout", { country: "ZA" })).toBe("treatment");
  });

  it("getVariant returns default variant when no rules match", async () => {
    client = new FeatureFlagClient(
      { envKey: "ff_test", baseUrl: "http://localhost:3000" },
      createMockFetch() as any
    );
    await client.sync();

    expect(client.getVariant("new-checkout", { country: "US" })).toBe("control");
  });

  it("returns safe defaults when no snapshot exists", () => {
    client = new FeatureFlagClient(
      { envKey: "ff_test", baseUrl: "http://localhost:3000" },
      createMockFetch() as any
    );

    // No sync called
    expect(client.isEnabled("new-checkout")).toBe(false);
    expect(client.getVariant("new-checkout")).toBe("control");
  });

  it("keeps last snapshot on failed sync after retries", async () => {
    vi.useFakeTimers();
    const failFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    client = new FeatureFlagClient(
      { envKey: "ff_test", baseUrl: "http://localhost:3000" },
      createMockFetch() as any
    );

    await client.sync();
    expect(client.isEnabled("new-checkout", { userId: "1" })).toBe(true);

    // Swap to failing fetch
    (client as any)._fetchFn = failFetch;
    const syncPromise = client.sync();
    // Advance through all retry delays (1s, 2s, 4s)
    await vi.advanceTimersByTimeAsync(10_000);
    await syncPromise;

    // Still has old snapshot after all retries exhausted
    expect(client.isEnabled("new-checkout", { userId: "1" })).toBe(true);
    // 1 initial + 3 retries = 4 total attempts
    expect(failFetch).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it("retries with backoff then succeeds", async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSnapshot),
      });

    client = new FeatureFlagClient(
      { envKey: "ff_test", baseUrl: "http://localhost:3000" },
      mockFetch as any
    );

    const syncPromise = client.sync();
    // Advance through retry delays
    await vi.advanceTimersByTimeAsync(5_000);
    await syncPromise;

    // Succeeded on 3rd attempt
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(client.getSnapshot()).toEqual(mockSnapshot);
    vi.useRealTimers();
  });

  it("init starts auto-refresh", async () => {
    vi.useFakeTimers();
    const mockFetch = createMockFetch();
    client = new FeatureFlagClient(
      { envKey: "ff_test", baseUrl: "http://localhost:3000", refreshIntervalMs: 1000 },
      mockFetch as any
    );

    await client.init();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance timer
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    client.close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(3); // No more calls after close

    vi.useRealTimers();
  });
});
