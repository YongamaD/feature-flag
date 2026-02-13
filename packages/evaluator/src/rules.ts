import type { Condition, Rule, EvaluationContext } from "./types.js";

/**
 * Evaluate a single condition against the context.
 * Returns false if the attribute is missing from context.
 */
export function evaluateCondition(
  condition: Condition,
  context: EvaluationContext
): boolean {
  const contextValue = context[condition.attr];

  // If the attribute is missing from context, condition fails
  if (contextValue === undefined || contextValue === null) {
    return false;
  }

  switch (condition.op) {
    case "EQ":
      return contextValue === condition.value;

    case "NEQ":
      return contextValue !== condition.value;

    case "IN": {
      if (!Array.isArray(condition.value)) return false;
      return condition.value.includes(contextValue);
    }

    case "NOT_IN": {
      if (!Array.isArray(condition.value)) return false;
      return !condition.value.includes(contextValue);
    }

    case "GT": {
      if (typeof contextValue !== "number" || typeof condition.value !== "number")
        return false;
      return contextValue > condition.value;
    }

    case "LT": {
      if (typeof contextValue !== "number" || typeof condition.value !== "number")
        return false;
      return contextValue < condition.value;
    }

    case "CONTAINS": {
      if (typeof contextValue !== "string" || typeof condition.value !== "string")
        return false;
      return contextValue.includes(condition.value);
    }

    default:
      return false;
  }
}

/**
 * Evaluate a rule — all conditions must match (AND logic).
 */
export function evaluateRule(
  rule: Rule,
  context: EvaluationContext
): boolean {
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every((cond) => evaluateCondition(cond, context));
}
