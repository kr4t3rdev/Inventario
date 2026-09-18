import { pathToFileURL } from 'node:url';

type FetchImplementation = typeof fetch;

type MonitorEnvironment = Record<string, string | undefined>;

export interface ReportMonitorConfig {
  baseUrl: string;
  authCookie: string;
  accountId: string;
  timeoutMs: number;
  runUntil?: Date;
}

interface ReportCheck {
  name: string;
  method: 'GET';
  path: string;
  expectedContentType: string;
  expectedPrefix?: string;
}

interface CheckResult {
  name: string;
  ok: boolean;
  status: number | null;
  latencyMs: number;
  contentType: string | null;
  bytes: number;
  errorCode?: 'HTTP_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR' | 'UNEXPECTED_CONTENT_TYPE' |
    'UNEXPECTED_BODY';
}

export interface ReportMonitorResult {
  event: 'accounting_reports_monitor';
  version: 1;
  timestamp: string;
  durationMs: number;
  ok: boolean;
  checks: CheckResult[];
  skipped?: boolean;
  skipReason?: 'OBSERVATION_WINDOW_EXPIRED';
}

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * @description Lee y valida la configuración segura del monitor desde variables de entorno.
 * @param {MonitorEnvironment} environment - Variables disponibles para el proceso.
 * @returns {ReportMonitorConfig} Configuración validada del monitor.
 */
export function readMonitorConfig(environment: MonitorEnvironment): ReportMonitorConfig {
  const baseUrl = environment.REPORT_MONITOR_BASE_URL;
  if (!baseUrl) {
    throw new Error('REPORT_MONITOR_BASE_URL is required');
  }

  const parsedBaseUrl = new URL(baseUrl);
  if (parsedBaseUrl.protocol !== 'https:') {
    throw new Error('REPORT_MONITOR_BASE_URL must use HTTPS');
  }

  const authCookie = environment.REPORT_MONITOR_AUTH_COOKIE;
  if (!authCookie) {
    throw new Error('REPORT_MONITOR_AUTH_COOKIE is required');
  }
  if (/\r|\n/.test(authCookie)) {
    throw new Error('REPORT_MONITOR_AUTH_COOKIE contains invalid characters');
  }

  const accountId = environment.REPORT_MONITOR_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('REPORT_MONITOR_ACCOUNT_ID is required');
  }

  const timeoutMs = Number(environment.REPORT_MONITOR_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30_000) {
    throw new Error('REPORT_MONITOR_TIMEOUT_MS must be an integer between 500 and 30000');
  }

  const runUntilValue = environment.REPORT_MONITOR_RUN_UNTIL;
  const runUntil = runUntilValue ? new Date(runUntilValue) : undefined;
  if (runUntilValue && Number.isNaN(runUntil?.getTime())) {
    throw new Error('REPORT_MONITOR_RUN_UNTIL must be a valid ISO date');
  }

  return {
    baseUrl: parsedBaseUrl.origin,
    authCookie,
    accountId,
    timeoutMs,
    ...(runUntil ? { runUntil } : {}),
  };
}

/**
 * @description Define las verificaciones GET de solo lectura para los reportes contables.
 * @param {string} accountId - Cuenta bancaria usada para verificar el historial.
 * @returns {ReportCheck[]} Lista de superficies y contratos esperados.
 */
export function buildReportChecks(accountId: string): ReportCheck[] {
  const encodedAccountId = encodeURIComponent(accountId);
  const boundedQuery = 'page=1&limit=10';

  return [
    {
      name: 'reports-page',
      method: 'GET',
      path: '/busy/contabilidad/reportes',
      expectedContentType: 'text/html',
    },
    {
      name: 'summary',
      method: 'GET',
      path: '/api/contabilidad/reportes/resumen',
      expectedContentType: 'application/json',
    },
    {
      name: 'movements',
      method: 'GET',
      path: `/api/contabilidad/reportes/movimientos?${boundedQuery}`,
      expectedContentType: 'application/json',
    },
    {
      name: 'csv-export',
      method: 'GET',
      path: `/api/contabilidad/reportes/movimientos?${boundedQuery}&formato=csv`,
      expectedContentType: 'text/csv',
    },
    {
      name: 'pdf-export',
      method: 'GET',
      path: `/api/contabilidad/reportes/movimientos?${boundedQuery}&formato=pdf`,
      expectedContentType: 'application/pdf',
      expectedPrefix: '%PDF-',
    },
    {
      name: 'account-history',
      method: 'GET',
      path: `/api/mobile/v1/accounting/bank-accounts/${encodedAccountId}/history?limit=10`,
      expectedContentType: 'application/json',
    },
  ];
}

async function executeCheck(
  config: ReportMonitorConfig,
  check: ReportCheck,
  fetchImplementation: FetchImplementation,
): Promise<CheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetchImplementation(new URL(check.path, config.baseUrl), {
      method: check.method,
      headers: {
        Accept: check.expectedContentType,
        Cookie: config.authCookie,
        'User-Agent': 'tcp-accounting-reports-monitor/1.0',
      },
      redirect: 'manual',
      signal: controller.signal,
    });
    const body = await response.arrayBuffer();
    const contentType = response.headers.get('content-type');
    const typeMatches = contentType?.toLowerCase().startsWith(check.expectedContentType) ?? false;
    const prefixMatches = check.expectedPrefix
      ? new TextDecoder().decode(body.slice(0, check.expectedPrefix.length)) === check.expectedPrefix
      : true;
    const ok = response.ok && typeMatches && prefixMatches;
    let errorCode: CheckResult['errorCode'];

    if (!response.ok) errorCode = 'HTTP_ERROR';
    else if (!typeMatches) errorCode = 'UNEXPECTED_CONTENT_TYPE';
    else if (!prefixMatches) errorCode = 'UNEXPECTED_BODY';

    return {
      name: check.name,
      ok,
      status: response.status,
      latencyMs: Number((performance.now() - startedAt).toFixed(1)),
      contentType,
      bytes: body.byteLength,
      ...(errorCode ? { errorCode } : {}),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      status: null,
      latencyMs: Number((performance.now() - startedAt).toFixed(1)),
      contentType: null,
      bytes: 0,
      errorCode: error instanceof Error && error.name === 'AbortError'
        ? 'TIMEOUT'
        : 'NETWORK_ERROR',
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @description Ejecuta en serie el smoke monitor de reportes sin modificar datos.
 * @param {ReportMonitorConfig} config - Configuración validada de producción.
 * @param {FetchImplementation} fetchImplementation - Cliente HTTP inyectable para pruebas.
 * @returns {Promise<ReportMonitorResult>} Métricas estructuradas sin credenciales.
 */
export async function runAccountingReportsMonitor(
  config: ReportMonitorConfig,
  fetchImplementation: FetchImplementation = fetch,
  now: Date = new Date(),
): Promise<ReportMonitorResult> {
  const startedAt = performance.now();

  if (config.runUntil && now.getTime() > config.runUntil.getTime()) {
    return {
      event: 'accounting_reports_monitor',
      version: 1,
      timestamp: now.toISOString(),
      durationMs: Number((performance.now() - startedAt).toFixed(1)),
      ok: true,
      skipped: true,
      skipReason: 'OBSERVATION_WINDOW_EXPIRED',
      checks: [],
    };
  }

  const checks: CheckResult[] = [];

  for (const check of buildReportChecks(config.accountId)) {
    checks.push(await executeCheck(config, check, fetchImplementation));
  }

  return {
    event: 'accounting_reports_monitor',
    version: 1,
    timestamp: new Date().toISOString(),
    durationMs: Number((performance.now() - startedAt).toFixed(1)),
    ok: checks.every((check) => check.ok),
    checks,
  };
}

async function main(): Promise<void> {
  try {
    const result = await runAccountingReportsMonitor(readMonitorConfig(process.env));
    console.log(JSON.stringify(result));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({
      event: 'accounting_reports_monitor_config_error',
      version: 1,
      timestamp: new Date().toISOString(),
      ok: false,
      errorCode: 'INVALID_CONFIGURATION',
      message: error instanceof Error ? error.message : 'Unknown configuration error',
    }));
    process.exitCode = 1;
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entryUrl && import.meta.url === entryUrl) {
  void main();
}
