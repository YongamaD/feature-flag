export type ConditionOperator = "EQ" | "NEQ" | "IN" | "NOT_IN" | "GT" | "LT" | "CONTAINS";

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

export interface FlagVersion {
  id: string;
  version: number;
  stateJson: FlagState;
  createdBy: string;
  createdAt: string;
}

export interface Flag {
  id: string;
  environmentId: string;
  key: string;
  description: string;
  isArchived: boolean;
  createdAt: string;
  versions: FlagVersion[];
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
}

export interface EnvironmentWithKey extends Environment {
  apiKey: string;
}

export interface AuditLogEntry {
  id: string;
  environmentId: string;
  actor: string;
  action: string;
  entityKey: string;
  diffJson: unknown;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthUser {
  sub: string;
  role: "admin" | "editor";
  exp: number;
}
