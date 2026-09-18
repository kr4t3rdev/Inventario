export const DEFAULT_EXPORT_LIMIT = 10_000;

export function normalizeExportLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_EXPORT_LIMIT;
  return Math.min(DEFAULT_EXPORT_LIMIT, Math.max(1, Math.floor(value as number)));
}

export function summarizeDurations(durations: number[]) {
  const values = durations.filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return { count: 0, minMs: 0, maxMs: 0, p50Ms: 0, p95Ms: 0 };
  const percentile = (ratio: number) => values[Math.ceil(values.length * ratio) - 1] ?? values.at(-1)!;
  return { count: values.length, minMs: values[0], maxMs: values.at(-1)!, p50Ms: percentile(0.5), p95Ms: percentile(0.95) };
}

export interface ReleaseGateInput { e2ePassed: boolean; buildPassed: boolean; typecheckPassed: boolean; p95Ms?: number; p95BudgetMs?: number }
export interface ReleaseGateResult { approved: boolean; failures: string[] }

export function evaluateReportReleaseGate(input: ReleaseGateInput): ReleaseGateResult {
  const failures: string[] = [];
  if (!input.e2ePassed) failures.push('E2E suite failed');
  if (!input.buildPassed) failures.push('production build failed');
  if (!input.typecheckPassed) failures.push('typecheck failed');
  if (input.p95Ms !== undefined && input.p95BudgetMs !== undefined && input.p95Ms > input.p95BudgetMs) failures.push(`p95 latency exceeds budget (${input.p95Ms}ms > ${input.p95BudgetMs}ms)`);
  return { approved: failures.length === 0, failures };
}
