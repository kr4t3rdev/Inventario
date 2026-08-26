import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  CircleCheck,
  FileSearch,
  Landmark,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { JSX } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { formatAccountingDate, getFunctionalCurrency } from './formatters';
import type { FinancialData } from './types';

interface ReportStatusBandProps {
  data: FinancialData;
}

interface MethodologyPanelProps {
  data: FinancialData;
}

interface AccountingPolicyRequiredStateProps {
  canManage: boolean;
  configurationHref: string | null;
  onRetry: () => void;
}

/**
 * @description Presenta el checkpoint de integridad cuando falta la moneda funcional.
 * @param {AccountingPolicyRequiredStateProps} props - Capacidad confirmada y recuperación.
 * @returns {JSX.Element} Estado accesible de configuración requerida.
 */
export function AccountingPolicyRequiredState({
  canManage,
  configurationHref,
  onRetry,
}: AccountingPolicyRequiredStateProps): JSX.Element {
  return (
    <section
      role="status"
      aria-label="Configuración requerida"
      aria-labelledby="accounting-policy-required-title"
      className="overflow-hidden rounded-2xl border border-amber-300/80 bg-[oklch(0.97_0.035_82)] text-amber-950 shadow-[0_14px_36px_-28px_rgba(120,73,10,0.65)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-150 dark:border-amber-800 dark:bg-[oklch(0.19_0.025_72)] dark:text-amber-50"
    >
      <div className="grid lg:grid-cols-12">
        <div className="min-w-0 px-5 py-7 sm:px-8 sm:py-9 lg:col-span-7">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300">
            Configuración requerida
          </p>
          <h2
            id="accounting-policy-required-title"
            tabIndex={-1}
            className="mt-3 max-w-2xl text-balance text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
          >
            Define la moneda funcional para consultar este reporte
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-amber-900/85 dark:text-amber-100/80">
            Balance y Resultados necesita una moneda funcional contable confirmada para
            presentar importes comparables. No se calculó ni se mostró información parcial.
          </p>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-amber-900 dark:text-amber-100">
            Esta decisión es independiente de la moneda principal del catálogo.
          </p>

          {!canManage && (
            <p className="mt-5 max-w-2xl rounded-xl bg-amber-100/75 px-4 py-3 text-sm leading-6 dark:bg-amber-950/45">
              Solicita a un administrador de esta empresa que configure la moneda funcional
              contable.
            </p>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {canManage && configurationHref && (
              <Button asChild className="min-h-11 w-full sm:w-auto">
                <Link href={configurationHref}>
                  Configurar moneda funcional
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onRetry}
              className="min-h-11 w-full border-amber-400/70 bg-transparent sm:w-auto dark:border-amber-700"
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reintentar consulta
            </Button>
          </div>
          {canManage && (
            <p className="mt-3 text-xs leading-5 text-amber-800 dark:text-amber-300">
              La configuración se aplicará solo a esta empresa y quedará registrada en
              auditoría.
            </p>
          )}
          <span className="sr-only" aria-live="polite" />
        </div>

        <div className="flex min-w-0 flex-col justify-between border-t border-amber-300/70 bg-amber-100/45 px-5 py-7 sm:px-8 lg:col-span-5 lg:border-l lg:border-t-0 dark:border-amber-800 dark:bg-amber-950/25">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-[10px] border-amber-500 border-r-transparent text-amber-800 dark:border-amber-400 dark:border-r-transparent dark:text-amber-200">
            <Landmark className="h-9 w-9" aria-hidden="true" />
          </div>
          <ol className="mt-8 grid gap-3 font-mono text-xs font-semibold uppercase tracking-[0.1em] sm:grid-cols-3 lg:grid-cols-1">
            {['Configurar', 'Verificar', 'Consultar'].map((step, index) => (
              <li key={step} className="flex min-h-11 items-center gap-3 border-b border-amber-300/70 py-2 last:border-b-0 dark:border-amber-800">
                <span aria-hidden="true" className="text-amber-700 dark:text-amber-300">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/**
 * @description Comunica procedencia, provisionalidad y cobertura del reporte.
 * @param {ReportStatusBandProps} props - Reporte financiero cargado.
 * @returns {JSX.Element} Banda de confianza y revisión.
 */
export function ReportStatusBand({ data }: ReportStatusBandProps): JSX.Element {
  const isSnapshot = data.reporte.origen === 'SNAPSHOT';
  const coverage = data.balance.cobertura;
  const hasPartialCoverage = coverage?.complete === false || (coverage?.unresolvedCount ?? 0) > 0;

  return (
    <section
      aria-label="Estado del reporte"
      aria-live="polite"
      role="status"
      className={cn(
        'flex flex-col gap-4 rounded-2xl border px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5',
        isSnapshot
          ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
          : 'border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {isSnapshot ? (
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
        ) : (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="font-semibold">
            {isSnapshot ? 'Cierre aprobado e íntegro' : 'Reporte provisional en vivo'}
          </p>
          <p className="mt-1 text-sm opacity-80">
            {isSnapshot
              ? `Balance al ${formatAccountingDate(data.reporte.fechaCorte)}; resultado hasta ${formatAccountingDate(data.reporte.resultadoHasta ?? data.reporte.fechaCorte)}.`
              : `Los importes se calculan al ${formatAccountingDate(data.reporte.fechaCorte, true)} y pueden cambiar con nuevos movimientos.`}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-sm">
        <span className="rounded-full border border-current/15 bg-white/45 px-3 py-1.5 font-medium dark:bg-black/10">
          {hasPartialCoverage ? 'Cobertura parcial' : 'Cobertura completa'}
        </span>
        {hasPartialCoverage && (
          <Link
            href="/busy/contabilidad/reconciliacion"
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            Revisar pendientes
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}

/**
 * @description Explica de forma compacta la procedencia y lectura de las cifras.
 * @param {MethodologyPanelProps} props - Reporte financiero actual.
 * @returns {JSX.Element} Panel desplegable de metodología.
 */
export function MethodologyPanel({ data }: MethodologyPanelProps): JSX.Element {
  const isSnapshot = data.reporte.origen === 'SNAPSHOT';
  return (
    <details className="group rounded-2xl border border-border/70 bg-card/60 shadow-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span>Cómo leer este reporte</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-3 border-t border-border/70 px-4 py-4 text-sm leading-6 text-muted-foreground sm:grid-cols-3 sm:px-5">
        <p><strong className="text-foreground">Balance:</strong> activos, pasivos y patrimonio muestran la posición financiera en la fecha de corte.</p>
        <p><strong className="text-foreground">Resultados:</strong> ingresos y gastos se presentan con base en operaciones reconciliadas del período.</p>
        <p><strong className="text-foreground">Procedencia:</strong> {isSnapshot ? 'este cierre proviene de un snapshot aprobado e íntegro.' : 'este reporte se calcula en vivo y conserva carácter provisional.'}</p>
      </div>
    </details>
  );
}

interface ReportLoadingStateProps {
  label?: string;
}

/**
 * @description Esqueleto estable para evitar saltos mientras cambia el período.
 * @param {ReportLoadingStateProps} props - Texto opcional del estado.
 * @returns {JSX.Element} Estado de carga accesible.
 */
export function ReportLoadingState({ label = 'Cargando reporte financiero' }: ReportLoadingStateProps): JSX.Element {
  return (
    <div className="space-y-6" aria-live="polite" role="status" aria-label={label}>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
        <span>{label}...</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-32 rounded-2xl motion-reduce:animate-none" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

interface ReportErrorStateProps {
  message: string | null;
  onRetry: () => void;
}

/**
 * @description Estado de error con reintento explícito y lenguaje accionable.
 * @param {ReportErrorStateProps} props - Mensaje del servidor y callback de reintento.
 * @returns {JSX.Element} Alerta de error.
 */
export function ReportErrorState({ message, onRetry }: ReportErrorStateProps): JSX.Element {
  return (
    <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-rose-300 bg-rose-50/60 px-6 py-10 text-center dark:border-rose-900 dark:bg-rose-950/20" role="alert">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
        <FileSearch className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-rose-950 dark:text-rose-100">No pudimos cargar este período</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-rose-800/80 dark:text-rose-200/80">
        {message || 'Ocurrió un problema al consultar la información financiera.'}
      </p>
      <Button type="button" variant="outline" onClick={onRetry} className="mt-5 min-h-11 border-rose-300 bg-transparent text-rose-900 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-100 dark:hover:bg-rose-950/60">
        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
        Reintentar consulta
      </Button>
    </section>
  );
}

interface EmptyReportStateProps {
  currency?: string;
}

/**
 * @description Explica que un reporte sin fuentes no equivale a un balance válido en cero.
 * @param {EmptyReportStateProps} props - Moneda funcional disponible.
 * @returns {JSX.Element} Estado vacío del reporte.
 */
export function EmptyReportState({ currency }: EmptyReportStateProps): JSX.Element {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
        <FileSearch className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-xl font-semibold tracking-tight">Sin actividad registrada</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        No hay fuentes contables ni movimientos para construir un balance de este período en {getFunctionalCurrency(currency)}. Cuando existan operaciones, aparecerán aquí con su cobertura y procedencia.
      </p>
    </section>
  );
}
