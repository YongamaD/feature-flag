import type { FlagState, EvaluationContext, EvaluationResult } from "@feature-flags/evaluator";

export interface SDKConfig {
  envKey: string;
  baseUrl: string;
  refreshIntervalMs?: number;
}

export interface Snapshot {
  environmentId: string;
  version: number;
  flags: Record<string, FlagState>;
}

export type { FlagState, EvaluationContext, EvaluationResult };
