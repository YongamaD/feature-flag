import { evaluate, type EvaluationContext, type EvaluationResult, type FlagState } from "@feature-flags/evaluator";
import type { SDKConfig, Snapshot } from "./types.js";

const DEFAULT_REFRESH_INTERVAL = 30_000; // 30 seconds

export class FeatureFlagClient {
  private config: SDKConfig;
  private snapshot: Snapshot | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private _fetchFn: typeof fetch;

  constructor(config: SDKConfig, fetchFn?: typeof fetch) {
    this.config = config;
    this._fetchFn = fetchFn || globalThis.fetch;
  }

  /**
   * Initialize the client by fetching the initial snapshot
   * and starting the auto-refresh interval.
   */
  async init(): Promise<void> {
    await this.sync();
    this.startRefresh();
  }

  /**
   * Fetch the latest snapshot from the API.
   * On failure, keeps the last known snapshot.
   */
  async sync(): Promise<void> {
    try {
      const url = `${this.config.baseUrl}/v1/flags/snapshot`;
      const response = await this._fetchFn(url, {
        headers: {
          Authorization: `Bearer ${this.config.envKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Snapshot fetch failed: ${response.status}`);
      }

      this.snapshot = (await response.json()) as Snapshot;
    } catch (err) {
      // Graceful degradation: keep last known snapshot
      if (!this.snapshot) {
        console.warn("[feature-flags] Failed to fetch snapshot, no fallback available:", err);
      }
    }
  }

  /**
   * Check if a flag is enabled for the given context.
   */
  isEnabled(flagKey: string, context: EvaluationContext = {}): boolean {
    const result = this.evaluateFlag(flagKey, context);
    return result.enabled;
  }

  /**
   * Get the variant for a flag given the context.
   */
  getVariant(flagKey: string, context: EvaluationContext = {}): string | null {
    const result = this.evaluateFlag(flagKey, context);
    return result.variant;
  }

  /**
   * Full evaluation result including reason.
   */
  evaluateFlag(flagKey: string, context: EvaluationContext = {}): EvaluationResult {
    if (!this.snapshot || !this.snapshot.flags[flagKey]) {
      // Safe default: disabled
      return { enabled: false, variant: "control", reason: "DISABLED" };
    }

    const flagState = this.snapshot.flags[flagKey];
    return evaluate(flagState, flagKey, context);
  }

  /**
   * Get the current snapshot (for debugging/testing).
   */
  getSnapshot(): Snapshot | null {
    return this.snapshot;
  }

  /**
   * Stop the auto-refresh interval and clean up.
   */
  close(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private startRefresh(): void {
    const interval = this.config.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL;
    this.refreshTimer = setInterval(() => {
      this.sync().catch(() => {
        // Errors handled in sync()
      });
    }, interval);
  }
}
