import { describe, expect, it } from 'vitest';
import {
  evaluateReportReleaseGate,
  normalizeExportLimit,
  summarizeDurations,
} from '../src/lib/reports-release-check';

describe('reportes release checks', () => {
  it('clamps export limits to protect memory', () => {
    expect(normalizeExportLimit(undefined)).toBe(10000);
    expect(normalizeExportLimit(500)).toBe(500);
    expect(normalizeExportLimit(50000)).toBe(10000);
    expect(normalizeExportLimit(0)).toBe(1);
  });

  it('summarizes latency percentiles deterministically', () => {
    expect(summarizeDurations([30, 10, 20, 40, 50])).toEqual({
      count: 5,
      minMs: 10,
      maxMs: 50,
      p50Ms: 30,
      p95Ms: 50,
    });
  });

  it('blocks release when required checks fail', () => {
    const result = evaluateReportReleaseGate({
      e2ePassed: false,
      buildPassed: true,
      typecheckPassed: true,
      p95Ms: 900,
      p95BudgetMs: 800,
    });
    expect(result.approved).toBe(false);
    expect(result.failures).toEqual([
      'E2E suite failed',
      'p95 latency exceeds budget (900ms > 800ms)',
    ]);
  });
});
