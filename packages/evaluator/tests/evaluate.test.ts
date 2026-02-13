import { describe, it, expect } from "vitest";
import { evaluate } from "../src/evaluate.js";
import type { FlagState } from "../src/types.js";

const baseState: FlagState = {
  enabled: true,
  defaultVariant: "control",
  variants: ["control", "treatment"],
  rules: [],
  rollout: null,
};

describe("evaluate", () => {
  it("returns DISABLED when flag is disabled", () => {
    const state: FlagState = { ...baseState, enabled: false };
    const result = evaluate(state, "test-flag", { userId: "123" });
    expect(result).toEqual({
      enabled: false,
      variant: "control",
      reason: "DISABLED",
    });
  });

  it("returns DEFAULT when no rules or rollout", () => {
    const result = evaluate(baseState, "test-flag", { userId: "123" });
    expect(result).toEqual({
      enabled: true,
      variant: "control",
      reason: "DEFAULT",
    });
  });

  it("returns RULE_MATCH for matching rule", () => {
    const state: FlagState = {
      ...baseState,
      rules: [
        {
          id: "rule-1",
          conditions: [{ attr: "country", op: "EQ", value: "ZA" }],
          result: { enabled: true, variant: "treatment" },
        },
      ],
    };
    const result = evaluate(state, "test-flag", { userId: "1", country: "ZA" });
    expect(result).toEqual({
      enabled: true,
      variant: "treatment",
      reason: "RULE_MATCH",
    });
  });

  it("first matching rule wins", () => {
    const state: FlagState = {
      ...baseState,
      rules: [
        {
          id: "rule-1",
          conditions: [{ attr: "plan", op: "EQ", value: "pro" }],
          result: { enabled: true, variant: "treatment" },
        },
        {
          id: "rule-2",
          conditions: [{ attr: "plan", op: "EQ", value: "pro" }],
          result: { enabled: true, variant: "other" },
        },
      ],
    };
    const result = evaluate(state, "test", { plan: "pro" });
    expect(result.variant).toBe("treatment");
    expect(result.reason).toBe("RULE_MATCH");
  });

  it("falls through non-matching rules to rollout", () => {
    const state: FlagState = {
      ...baseState,
      rules: [
        {
          id: "rule-1",
          conditions: [{ attr: "plan", op: "EQ", value: "enterprise" }],
          result: { enabled: true, variant: "treatment" },
        },
      ],
      rollout: {
        type: "PERCENT",
        percentage: 100,
        stickinessKey: "userId",
      },
    };
    const result = evaluate(state, "test", { userId: "123", plan: "free" });
    expect(result.reason).toBe("ROLLOUT");
    expect(result.enabled).toBe(true);
  });

  it("rollout at 0% returns disabled", () => {
    const state: FlagState = {
      ...baseState,
      rollout: {
        type: "PERCENT",
        percentage: 0,
        stickinessKey: "userId",
      },
    };
    const result = evaluate(state, "test", { userId: "123" });
    expect(result.reason).toBe("ROLLOUT");
    expect(result.enabled).toBe(false);
    expect(result.variant).toBe("control");
  });

  it("rollout returns first variant when enabled", () => {
    const state: FlagState = {
      ...baseState,
      variants: ["beta", "stable"],
      rollout: {
        type: "PERCENT",
        percentage: 100,
        stickinessKey: "userId",
      },
    };
    const result = evaluate(state, "test", { userId: "any" });
    expect(result.variant).toBe("beta");
    expect(result.enabled).toBe(true);
  });

  it("disabled flag ignores rules and rollout", () => {
    const state: FlagState = {
      ...baseState,
      enabled: false,
      rules: [
        {
          id: "rule-1",
          conditions: [{ attr: "plan", op: "EQ", value: "pro" }],
          result: { enabled: true, variant: "treatment" },
        },
      ],
      rollout: {
        type: "PERCENT",
        percentage: 100,
        stickinessKey: "userId",
      },
    };
    const result = evaluate(state, "test", { userId: "1", plan: "pro" });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("DISABLED");
  });

  it("handles complex multi-condition rules", () => {
    const state: FlagState = {
      ...baseState,
      rules: [
        {
          id: "rule-1",
          conditions: [
            { attr: "country", op: "IN", value: ["ZA", "NG"] },
            { attr: "plan", op: "EQ", value: "pro" },
            { attr: "age", op: "GT", value: 18 },
          ],
          result: { enabled: true, variant: "treatment" },
        },
      ],
    };

    // All conditions match
    expect(
      evaluate(state, "f", { country: "ZA", plan: "pro", age: 25 }).reason
    ).toBe("RULE_MATCH");

    // One condition fails
    expect(
      evaluate(state, "f", { country: "ZA", plan: "pro", age: 16 }).reason
    ).toBe("DEFAULT");

    // Missing attribute
    expect(
      evaluate(state, "f", { country: "ZA", plan: "pro" }).reason
    ).toBe("DEFAULT");
  });

  it("rule can return enabled: false", () => {
    const state: FlagState = {
      ...baseState,
      rules: [
        {
          id: "block-rule",
          conditions: [{ attr: "banned", op: "EQ", value: true }],
          result: { enabled: false, variant: "control" },
        },
      ],
    };
    const result = evaluate(state, "flag", { banned: true });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("RULE_MATCH");
  });
});
