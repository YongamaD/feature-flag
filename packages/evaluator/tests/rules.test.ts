import { describe, it, expect } from "vitest";
import { evaluateCondition, evaluateRule } from "../src/rules.js";
import type { Condition, Rule } from "../src/types.js";

describe("evaluateCondition", () => {
  it("EQ: matches equal values", () => {
    const cond: Condition = { attr: "plan", op: "EQ", value: "pro" };
    expect(evaluateCondition(cond, { plan: "pro" })).toBe(true);
    expect(evaluateCondition(cond, { plan: "free" })).toBe(false);
  });

  it("NEQ: matches non-equal values", () => {
    const cond: Condition = { attr: "plan", op: "NEQ", value: "free" };
    expect(evaluateCondition(cond, { plan: "pro" })).toBe(true);
    expect(evaluateCondition(cond, { plan: "free" })).toBe(false);
  });

  it("IN: matches value in array", () => {
    const cond: Condition = { attr: "country", op: "IN", value: ["ZA", "NG", "KE"] };
    expect(evaluateCondition(cond, { country: "ZA" })).toBe(true);
    expect(evaluateCondition(cond, { country: "US" })).toBe(false);
  });

  it("NOT_IN: matches value not in array", () => {
    const cond: Condition = { attr: "country", op: "NOT_IN", value: ["CN", "RU"] };
    expect(evaluateCondition(cond, { country: "ZA" })).toBe(true);
    expect(evaluateCondition(cond, { country: "CN" })).toBe(false);
  });

  it("GT: matches greater than", () => {
    const cond: Condition = { attr: "age", op: "GT", value: 18 };
    expect(evaluateCondition(cond, { age: 25 })).toBe(true);
    expect(evaluateCondition(cond, { age: 18 })).toBe(false);
    expect(evaluateCondition(cond, { age: 10 })).toBe(false);
  });

  it("LT: matches less than", () => {
    const cond: Condition = { attr: "age", op: "LT", value: 65 };
    expect(evaluateCondition(cond, { age: 30 })).toBe(true);
    expect(evaluateCondition(cond, { age: 65 })).toBe(false);
    expect(evaluateCondition(cond, { age: 80 })).toBe(false);
  });

  it("CONTAINS: matches substring", () => {
    const cond: Condition = { attr: "email", op: "CONTAINS", value: "@acme.com" };
    expect(evaluateCondition(cond, { email: "user@acme.com" })).toBe(true);
    expect(evaluateCondition(cond, { email: "user@other.com" })).toBe(false);
  });

  it("returns false for missing context attribute", () => {
    const cond: Condition = { attr: "plan", op: "EQ", value: "pro" };
    expect(evaluateCondition(cond, {})).toBe(false);
    expect(evaluateCondition(cond, { other: "value" })).toBe(false);
  });

  it("returns false for null context attribute", () => {
    const cond: Condition = { attr: "plan", op: "EQ", value: "pro" };
    expect(evaluateCondition(cond, { plan: null })).toBe(false);
  });

  it("GT/LT return false for non-numeric values", () => {
    const gt: Condition = { attr: "age", op: "GT", value: 18 };
    expect(evaluateCondition(gt, { age: "old" })).toBe(false);
    const lt: Condition = { attr: "age", op: "LT", value: 18 };
    expect(evaluateCondition(lt, { age: "young" })).toBe(false);
  });

  it("CONTAINS returns false for non-string values", () => {
    const cond: Condition = { attr: "name", op: "CONTAINS", value: "test" };
    expect(evaluateCondition(cond, { name: 123 })).toBe(false);
  });

  it("IN returns false when value is not an array", () => {
    const cond: Condition = { attr: "country", op: "IN", value: "ZA" };
    expect(evaluateCondition(cond, { country: "ZA" })).toBe(false);
  });
});

describe("evaluateRule", () => {
  it("matches when all conditions pass (AND logic)", () => {
    const rule: Rule = {
      id: "r1",
      conditions: [
        { attr: "country", op: "IN", value: ["ZA", "NG"] },
        { attr: "plan", op: "EQ", value: "pro" },
      ],
      result: { enabled: true, variant: "treatment" },
    };

    expect(evaluateRule(rule, { country: "ZA", plan: "pro" })).toBe(true);
    expect(evaluateRule(rule, { country: "ZA", plan: "free" })).toBe(false);
    expect(evaluateRule(rule, { country: "US", plan: "pro" })).toBe(false);
  });

  it("returns false for empty conditions", () => {
    const rule: Rule = {
      id: "r1",
      conditions: [],
      result: { enabled: true, variant: "treatment" },
    };
    expect(evaluateRule(rule, { any: "thing" })).toBe(false);
  });

  it("works with a single condition", () => {
    const rule: Rule = {
      id: "r1",
      conditions: [{ attr: "beta", op: "EQ", value: true }],
      result: { enabled: true, variant: "on" },
    };
    expect(evaluateRule(rule, { beta: true })).toBe(true);
    expect(evaluateRule(rule, { beta: false })).toBe(false);
  });
});
