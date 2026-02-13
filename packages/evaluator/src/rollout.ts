import { computeBucket } from "./hash.js";
import type { RolloutConfig, EvaluationContext } from "./types.js";

/**
 * Evaluate a percentage rollout.
 * Returns true if the user falls within the rollout percentage.
 */
export function evaluateRollout(
  rollout: RolloutConfig,
  flagKey: string,
  context: EvaluationContext
): boolean {
  const stickinessValue = context[rollout.stickinessKey];

  // If the stickiness key is missing, rollout fails (user excluded)
  if (stickinessValue === undefined || stickinessValue === null) {
    return false;
  }

  const userId = String(stickinessValue);
  const bucket = computeBucket(userId, flagKey);
  return bucket < rollout.percentage;
}
