'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/contexts/auth-context';
import { BalanceResultsHeader } from '@/features/contabilidad/components/balance-resultados/balance-results-header';
import { BalanceResultsView } from '@/features/contabilidad/components/balance-resultados/balance-results-view';
import {
  EmptyReportState,
  AccountingPolicyRequiredState,
  ReportErrorState,
  ReportLoadingState,
  ReportStatusBand,
} from '@/features/contabilidad/components/balance-resultados/report-states';
import {
  formatAccountingDate,
  getFunctionalCurrency,
  isEmptyFinancialReport,
} from '@/features/contabilidad/components/balance-resultados/formatters';
import type {
  FinancialData,
  FinancialPeriod,
} from '@/features/contabilidad/components/balance-resultados/types';

interface ApiErrorBody {
  error?: string;
  code?: string;
  resolution?: {
    canManage?: boolean;
    configurationHref?: string | null;
  };
}

interface ReportError {
  status: number;
  code: string | null;
  message: string;
  resolution: {
    canManage: boolean;
    configurationHref: string | null;
  } | null;
}

/**
 * @description Lee el mensaje seguro de una respuesta HTTP fallida.
 * @param {unknown} body - JSON recibido del servidor.
 * @param {number} status - Código HTTP de la respuesta.
 * @returns {string} Mensaje accionable para la interfaz.
 */
function getApiErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as ApiErrorBody).error;
    if (typeof error === 'string' && error.trim()) return error;
  }
  if (status === 409) return 'Este período no tiene evidencia histórica suficiente para consultarse.';
  return `No se pudo cargar el reporte (error ${status}).`;
}

/**
 * @description Conserva el contrato estructurado de un error seguro del reporte.
 * @param {unknown} body - JSON recibido del servidor.
 * @param {number} status - Estado HTTP.
 * @returns {ReportError} Error tipado para seleccionar el estado visual correcto.
 */
function parseReportError(body: unknown, status: number): ReportError {
  const payload = body && typeof body === 'object' ? body as ApiErrorBody : {};
  const resolution = payload.resolution;
  return {
    status,
    code: typeof payload.code === 'string' ? payload.code : null,
    message: getApiErrorMessage(body, status),
    resolution: resolution ? {
      canManage: resolution.canManage === true,
      configurationHref: typeof resolution.configurationHref === 'string'
        ? resolution.configurationHref
        : null,
    } : null,
  };
}

/**
 * @description Pantalla operativa para revisar el balance general y el estado de resultados.
 * @returns {JSX.Element | null} Pantalla financiera o nada cuando el plan no tiene acceso.
 */
export default function BalanceResultadosPage(): JSX.Element | null {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState<FinancialData | null>(null);
  const [availablePeriods, setAvailablePeriods] = useState<FinancialPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reportError, setReportError] = useState<ReportError | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [activeView, setActiveView] = useState<'balance' | 'resultados'>('balance');
  const latestRequestId = useRef(0);
  const isBlocked = !authLoading && user?.role !== 'admin' && user?.planFeatures?.contabilidad !== true;
  const hasAuthenticatedUser = Boolean(user);

  useEffect(() => {
    if (isBlocked) router.replace('/busy/contabilidad');
  }, [isBlocked, router]);

  useEffect(() => {
    if (authLoading || isBlocked) return;
    if (!hasAuthenticatedUser) {
      setLoading(false);
      setErrorMsg('Tu sesión no está disponible. Vuelve a iniciar sesión para consultar este reporte.');
      return;
    }

    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    const controller = new AbortController();

    const fetchData = async (): Promise<void> => {
      setLoading(true);
      setErrorMsg(null);
      setReportError(null);
      setData(null);

      try {
        const [reportResponse, periodsResponse] = await Promise.all([
          fetch(`/api/contabilidad/balance-financiero?year=${encodeURIComponent(year)}`, { signal: controller.signal }),
          fetch('/api/contabilidad/balance-financiero/periodos', { signal: controller.signal }),
        ]);

        if (requestId !== latestRequestId.current) return;

        if (periodsResponse.ok) {
          const periodsPayload = await periodsResponse.json() as { periodos?: FinancialPeriod[] };
          if (requestId !== latestRequestId.current) return;
          setAvailablePeriods(periodsPayload.periodos ?? []);
        }

        if (!reportResponse.ok) {
          const body = await reportResponse.json().catch(() => ({}));
          if (requestId !== latestRequestId.current) return;
          const parsedError = parseReportError(body, reportResponse.status);
          setReportError(parsedError);
          setErrorMsg(parsedError.message);
          return;
        }

        const report = await reportResponse.json() as FinancialData;
        if (requestId !== latestRequestId.current) return;
        setData(report);
      } catch (error) {
        if (controller.signal.aborted || requestId !== latestRequestId.current) return;
        setErrorMsg('Error de red al conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.');
      } finally {
        if (requestId === latestRequestId.current) setLoading(false);
      }
    };

    void fetchData();
    return () => controller.abort();
  }, [authLoading, hasAuthenticatedUser, isBlocked, retryKey, year]);

  if (isBlocked) return null;

  const yearOptions = Array.from(new Set([
    currentYear,
    ...availablePeriods.map((period) => period.year),
  ])).sort((left, right) => right - left);

  const handleRetry = (): void => setRetryKey((key) => key + 1);

  return (
    <main className="min-h-full bg-background px-4 py-5 sm:px-6 sm:py-7 lg:px-8" aria-busy={loading}>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <BalanceResultsHeader
          data={data}
          activeView={activeView}
          year={year}
          yearOptions={yearOptions}
          currentYear={currentYear}
          isLoading={loading}
          onYearChange={setYear}
          onRetry={handleRetry}
        />

        {loading && !data ? (
          <ReportLoadingState label={`Cargando el período ${year}`} />
        ) : data ? (
          isEmptyFinancialReport(data) ? (
            <div className="space-y-6">
              <ReportStatusBand data={data} />
              <EmptyReportState currency={getFunctionalCurrency(data.balance.monedaFuncional)} />
              <p className="text-center text-xs text-muted-foreground">
                Última consulta: {formatAccountingDate(data.reporte.fechaCorte, true)}
              </p>
            </div>
          ) : (
            <BalanceResultsView data={data} activeTab={activeView} onTabChange={setActiveView} />
          )
        ) : reportError?.code === 'TENANT_ACCOUNTING_POLICY_REQUIRED' ? (
          <AccountingPolicyRequiredState
            canManage={reportError.resolution?.canManage === true}
            configurationHref={reportError.resolution?.configurationHref ?? null}
            onRetry={handleRetry}
          />
        ) : (
          <ReportErrorState message={errorMsg} onRetry={handleRetry} />
        )}
      </div>
    </main>
  );
}
