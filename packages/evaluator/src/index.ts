export { evaluate } from "./evaluate.js";
export { evaluateCondition, evaluateRule } from "./rules.js";
export { evaluateRollout } from "./rollout.js";
export { computeBucket, murmurhash3 } from "./hash.js";

export type {
  FlagState,
  Rule,
  Condition,
  ConditionOperator,
  RolloutConfig,
  RuleResult,
  EvaluationResult,
  EvaluationReason,
  EvaluationContext,
} from "./types.js";
