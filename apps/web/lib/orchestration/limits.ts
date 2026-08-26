/**
 * Orchestration limits.
 *
 * These bound what a model-generated plan can cause the system to do. They are
 * deliberately conservative: every one of them is the difference between a bad
 * plan being rejected and a bad plan spending money or spawning runs without
 * end.
 */

export const ORCHESTRATION_LIMITS = {
  /** Distinct agents one orchestration may delegate to. */
  MAX_DELEGATED_AGENTS: 4,

  /** Delegated runs executing at the same instant. */
  MAX_CONCURRENT_RUNS: 3,

  /**
   * Delegation depth. At 1, Hermes may delegate to an agent and that agent
   * may not delegate onward — the single rule that makes runaway recursive
   * delegation structurally impossible rather than merely discouraged.
   */
  MAX_ORCHESTRATION_DEPTH: 1,

  /** Steps in a single plan. */
  MAX_PLAN_STEPS: 6,

  /** How long one delegated run may take before it is cancelled. */
  STEP_TIMEOUT_MS: 90_000,

  /** Ceiling on the whole orchestration, including synthesis. */
  ORCHESTRATION_TIMEOUT_MS: 300_000,

  /** Characters of task text accepted per step. */
  MAX_TASK_CHARS: 1_000,
} as const;

export type OrchestrationLimits = typeof ORCHESTRATION_LIMITS;
