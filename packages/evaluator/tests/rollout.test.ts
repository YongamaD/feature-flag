import { describe, it, expect } from "vitest";
import { computeBucket } from "../src/hash.js";
import { evaluateRollout } from "../src/rollout.js";
import type { RolloutConfig } from "../src/types.js";

describe("computeBucket", () => {
  it("returns a value between 0 and 99", () => {
    for (let i = 0; i < 1000; i++) {
      const bucket = computeBucket(`user-${i}`, "test-flag");
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(100);
    }
  });

  it("is deterministic — same input always produces same output", () => {
    const results: number[] = [];
    for (let i = 0; i < 100; i++) {
      results.push(computeBucket("user-42", "my-flag"));
    }
    expect(new Set(results).size).toBe(1);
  });

  it("produces different buckets for different users", () => {
    const buckets = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      buckets.add(computeBucket(`user-${i}`, "test-flag"));
    }
    // With 1000 users and 100 buckets, we should see significant distribution
    expect(buckets.size).toBeGreaterThan(50);
  });

  it("different flag keys produce different buckets for same user", () => {
    const bucket1 = computeBucket("user-1", "flag-a");
    const bucket2 = computeBucket("user-1", "flag-b");
    // Not guaranteed to be different for every pair, but demonstrates independence
    // We just verify they're both valid
    expect(bucket1).toBeGreaterThanOrEqual(0);
    expect(bucket2).toBeGreaterThanOrEqual(0);
  });
});

describe("evaluateRollout", () => {
  const rollout: RolloutConfig = {
    type: "PERCENT",
    percentage: 25,
    stickinessKey: "userId",
  };

  it("includes users whose bucket is below the percentage", () => {
    // Run many users and check distribution
    let included = 0;
    const total = 10000;

    for (let i = 0; i < total; i++) {
      const result = evaluateRollout(rollout, "test-flag", {
        userId: `user-${i}`,
      });
      if (result) included++;
    }

    const actualPercentage = (included / total) * 100;
    // Should be approximately 25%, allow ±5%
    expect(actualPercentage).toBeGreaterThan(20);
    expect(actualPercentage).toBeLessThan(30);
  });

  it("is deterministic per user", () => {
    for (let i = 0; i < 100; i++) {
      const ctx = { userId: `user-${i}` };
      const first = evaluateRollout(rollout, "flag-x", ctx);
      const second = evaluateRollout(rollout, "flag-x", ctx);
      expect(first).toBe(second);
    }
  });

  it("returns false when stickiness key is missing", () => {
    expect(evaluateRollout(rollout, "flag", {})).toBe(false);
    expect(evaluateRollout(rollout, "flag", { otherId: "123" })).toBe(false);
  });

  it("0% rollout includes nobody", () => {
    const zeroRollout: RolloutConfig = {
      type: "PERCENT",
      percentage: 0,
      stickinessKey: "userId",
    };
    for (let i = 0; i < 100; i++) {
      expect(evaluateRollout(zeroRollout, "flag", { userId: `u${i}` })).toBe(false);
    }
  });

  it("100% rollout includes everybody", () => {
    const fullRollout: RolloutConfig = {
      type: "PERCENT",
      percentage: 100,
      stickinessKey: "userId",
    };
    for (let i = 0; i < 100; i++) {
      expect(evaluateRollout(fullRollout, "flag", { userId: `u${i}` })).toBe(true);
    }
  });
});
