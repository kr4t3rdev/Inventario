import { describe, expect, it, vi } from 'vitest';

import {
  buildReportChecks,
  readMonitorConfig,
  runAccountingReportsMonitor,
} from './accounting-reports-monitor';

describe('accounting reports production monitor', () => {
  it('requires an HTTPS base URL and an injected authentication cookie', () => {
    expect(() => readMonitorConfig({})).toThrow('REPORT_MONITOR_BASE_URL');
    expect(() =>
      readMonitorConfig({
        REPORT_MONITOR_BASE_URL: 'http://example.com',
        REPORT_MONITOR_AUTH_COOKIE: 'session=secret',
      }),
    ).toThrow('HTTPS');
    expect(() =>
      readMonitorConfig({ REPORT_MONITOR_BASE_URL: 'https://example.com' }),
    ).toThrow('REPORT_MONITOR_AUTH_COOKIE');
    expect(() =>
      readMonitorConfig({
        REPORT_MONITOR_BASE_URL: 'https://example.com',
        REPORT_MONITOR_AUTH_COOKIE: 'session=secret\r\nX-Injected: true',
        REPORT_MONITOR_ACCOUNT_ID: 'account-1',
      }),
    ).toThrow('invalid characters');
  });

  it('only builds read-only GET checks for report surfaces', () => {
    const checks = buildReportChecks('account-1');

    expect(checks.map((check) => check.name)).toEqual([
      'reports-page',
      'summary',
      'movements',
      'csv-export',
      'pdf-export',
      'account-history',
    ]);
    expect(checks.every((check) => check.method === 'GET')).toBe(true);
    expect(checks.at(-1)?.path).toContain('account-1');
  });

  it('records structured status, latency and content type without leaking auth', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('formato=pdf')) {
        return new Response('%PDF-1.7', {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        });
      }
      if (url.includes('formato=csv')) {
        return new Response('Fecha,Monto', {
          status: 200,
          headers: { 'content-type': 'text/csv; charset=utf-8' },
        });
      }
      if (url.includes('/busy/')) {
        return new Response('<html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      return Response.json({ data: [] });
    });

    const result = await runAccountingReportsMonitor(
      {
        baseUrl: 'https://example.com',
        authCookie: 'session=super-secret',
        accountId: 'account-1',
        timeoutMs: 2_000,
      },
      fetchMock,
    );

    expect(result.ok).toBe(true);
    expect(result.checks).toHaveLength(6);
    expect(result.checks[0]).toMatchObject({
      name: 'reports-page',
      status: 200,
      contentType: 'text/html; charset=utf-8',
    });
    expect(result.checks[0].latencyMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(result)).not.toContain('super-secret');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Cookie: 'session=super-secret' }),
        redirect: 'manual',
      }),
    );
  });

  it('marks timeouts and unexpected response types as failed checks', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/resumen')) {
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      }
      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const result = await runAccountingReportsMonitor(
      {
        baseUrl: 'https://example.com',
        authCookie: 'session=secret',
        accountId: 'account-1',
        timeoutMs: 10,
      },
      fetchMock,
    );

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === 'summary')).toMatchObject({
      ok: false,
      errorCode: 'TIMEOUT',
    });
    expect(result.checks.find((check) => check.name === 'pdf-export')).toMatchObject({
      ok: false,
      errorCode: 'UNEXPECTED_CONTENT_TYPE',
    });
  });

  it('skips checks after the configured 24h observation window expires', async () => {
    const fetchMock = vi.fn();
    const config = readMonitorConfig({
      REPORT_MONITOR_BASE_URL: 'https://example.com',
      REPORT_MONITOR_AUTH_COOKIE: 'session=secret',
      REPORT_MONITOR_ACCOUNT_ID: 'account-1',
      REPORT_MONITOR_RUN_UNTIL: '2026-09-03T00:00:00.000Z',
    });

    const result = await runAccountingReportsMonitor(
      config,
      fetchMock,
      new Date('2026-09-03T00:00:01.000Z'),
    );

    expect(result).toMatchObject({
      ok: true,
      skipped: true,
      skipReason: 'OBSERVATION_WINDOW_EXPIRED',
    });
    expect(result.checks).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

});
