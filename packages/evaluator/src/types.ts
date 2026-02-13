export type ConditionOperator =
  | "EQ"
  | "NEQ"
  | "IN"
  | "NOT_IN"
  | "GT"
  | "LT"
  | "CONTAINS";

export interface Condition {
  attr: string;
  op: ConditionOperator;
  value: unknown;
}

export interface RuleResult {
  enabled: boolean;
  variant: string;
}

export interface Rule {
  id: string;
  conditions: Condition[];
  result: RuleResult;
}

export interface RolloutConfig {
  type: "PERCENT";
  percentage: number;
  stickinessKey: string;
}

export interface FlagState {
  enabled: boolean;
  defaultVariant: string;
  variants: string[];
  rules: Rule[];
  rollout: RolloutConfig | null;
}

export type EvaluationReason =
  | "DISABLED"
  | "RULE_MATCH"
  | "ROLLOUT"
  | "DEFAULT";

export interface EvaluationResult {
  enabled: boolean;
  variant: string;
  reason: EvaluationReason;
}

export interface EvaluationContext {
  [key: string]: unknown;
}
