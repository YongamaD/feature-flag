import type {
  FlagState,
  EvaluationContext,
  EvaluationResult,
} from "./types.js";
import { evaluateRule } from "./rules.js";
import { evaluateRollout } from "./rollout.js";

/**
 * Evaluate a flag against a user context.
 *
 * Order:
 * 1. If flag disabled → return disabled
 * 2. Evaluate rules in order → first match wins
 * 3. If rollout exists → deterministic assignment
 * 4. Else → return default
 */
export function evaluate(
  state: FlagState,
  flagKey: string,
  context: EvaluationContext
): EvaluationResult {
  // 1. Globally disabled
  if (!state.enabled) {
    return {
      enabled: false,
      variant: state.defaultVariant,
      reason: "DISABLED",
    };
  }

  // 2. Rule evaluation — first match wins
  for (const rule of state.rules) {
    if (evaluateRule(rule, context)) {
      return {
        enabled: rule.result.enabled,
        variant: rule.result.variant,
        reason: "RULE_MATCH",
      };
    }
  }

  // 3. Rollout
  if (state.rollout) {
    const inRollout = evaluateRollout(state.rollout, flagKey, context);
    return {
      enabled: inRollout,
      variant: inRollout ? state.variants[0] : state.defaultVariant,
      reason: "ROLLOUT",
    };
  }

  // 4. Default
  return {
    enabled: state.enabled,
    variant: state.defaultVariant,
    reason: "DEFAULT",
  };
}
