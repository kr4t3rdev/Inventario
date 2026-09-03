'use client';

import { useState, useEffect, useRef } from 'react';
import { m as motion } from 'framer-motion';
import { Wallet, DollarSign } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getResumenCompletoAction } from '@/features/contabilidad/actions-resumen';
import { getSaldoNetoTotal } from '@/features/contabilidad/components/resumen-financiero-utils';
import { cn } from '@/lib/utils';

import { FinancialStatePanel } from './reportes/FinancialStatePanel';
import { AccountingAttentionPanel } from './reportes/AccountingAttentionPanel';
import { CurrencySummaryTable } from './reportes/CurrencySummaryTable';
import { AccountingDetailsDisclosure } from './reportes/AccountingDetailsDisclosure';
import { PeriodSelector } from './reportes/period-selector';
import {
  getRangoPeriodo,
  type PeriodoClave,
  type RangoPeriodo,
} from '@/features/contabilidad/lib/periodo-presets';

interface ResumenFinancieroProps {
  fechaInicio?: string;
  fechaFin?: string;
  cuentaId?: string;
  tipoGasto?: string;
  periodo: string;
  soloNoReconciliados?: boolean | undefined;
  page: number;
  limit: number;
  refreshToken?: number;
  showPeriodSelector?: boolean;
  /** Datos precargados en el servidor; si existen, el primer render no hace fetch. */
  initialData?: unknown;
}

export function ResumenFinanciero({
  fechaInicio: fechaInicioProp,
  fechaFin: fechaFinProp,
  cuentaId,
  periodo: periodoProp,
  refreshToken = 0,
  showPeriodSelector = false,
  initialData,
}: ResumenFinancieroProps): React.JSX.Element | null {
  const [periodoClave, setPeriodoClave] = useState<PeriodoClave>('mes');

  const rango: RangoPeriodo | null = showPeriodSelector
    ? getRangoPeriodo(periodoClave, new Date())
    : null;

  const fechaInicio = rango?.fechaInicio ?? fechaInicioProp;
  const fechaFin = rango?.fechaFin ?? fechaFinProp;
  const periodo = rango?.etiqueta ?? periodoProp;

  const [retryKey, setRetryKey] = useState(0);

  const [payload, setPayload] = useState<any>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<any>(null);
  const dataRequestRef = useRef(0);
  const skipInitialFetchRef = useRef(Boolean(initialData));

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    const requestId = ++dataRequestRef.current;
    let isActive = true;
    setIsLoading(true);
    setError(null);
    getResumenCompletoAction({ fechaInicio, fechaFin, cuentaId })
      .then(r => {
        if (!isActive || requestId !== dataRequestRef.current) return;
        if (r.success) {
          setPayload(r.data);
        } else {
          setError(r.error);
        }
        setIsLoading(false);
      })
      .catch(e => {
        if (!isActive || requestId !== dataRequestRef.current) return;
        setError(e);
        setIsLoading(false);
      });
    return () => { isActive = false; };
  }, [fechaInicio, fechaFin, cuentaId, retryKey, refreshToken]);

  const resumen = payload?.resumen ?? null;
  const monedasData = payload?.monedas ?? null;
  const prestamosCashData = payload?.prestamosStats ?? null;
  const resumenAnticiposData = payload?.resumenAnticipos ?? null;
  const conteos = payload?.conteos ?? null;

  if (isLoading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-live="polite">
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 border rounded-xl space-y-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-40" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 border rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="space-y-2 flex flex-col items-end">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/50 dark:bg-rose-950/20">
        <p className="text-rose-700 dark:text-rose-300">Error al cargar datos</p>
        <Button onClick={() => setRetryKey(k => k + 1)} variant="outline" className="mt-4">
          Intentar nuevamente
        </Button>
      </div>
    );
  }

  if (!resumen) return null;

  const monedasDisponibles = Array.isArray(monedasData) ? monedasData : [];
  const monedaPrincipal = monedasDisponibles.find((m: any) => m.esPrincipal)?.codigo
    || monedasDisponibles[0]?.codigo
    || resumen.resumenPorMoneda?.[0]?.moneda
    || 'CUP';
  const resumenPrincipal = resumen.resumenPorMoneda?.find((m: any) => m.moneda === monedaPrincipal);

  const ingresosTotales = resumenPrincipal?.totalIngresos ?? 0;
  const egresosTotales = resumenPrincipal?.totalEgresos ?? 0;
  const saldoNetoEnPrincipal = getSaldoNetoTotal(resumen.resumenPorMoneda, monedaPrincipal);

  const balances = resumen.resumenPorMoneda?.map((m: any) => ({
    moneda: m.moneda,
    saldo: m.saldoActual,
    ingresos: m.totalIngresos,
    egresos: m.totalEgresos,
  })) || [];

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-label="Período del reporte">
          Período: {periodo}
        </p>
        {showPeriodSelector && (
          <PeriodSelector value={periodoClave} onChange={setPeriodoClave} />
        )}
      </div>
      <FinancialStatePanel
        monedaPrincipal={monedaPrincipal}
        flujoNeto={saldoNetoEnPrincipal}
        ingresosTotales={ingresosTotales}
        egresosTotales={egresosTotales}
        balances={balances}
        flujoNetoAnterior={
          resumen.periodoAnterior?.porMoneda?.[monedaPrincipal]?.saldoNeto ?? null
        }
      />

      <AccountingAttentionPanel
        ventasPend={conteos?.ventas?.pending ?? 0}
        serviciosPend={conteos?.servicios?.pending ?? 0}
        gastosPend={conteos?.gastos?.pending ?? 0}
        conversionesSinCobertura={resumen.metadatos?.coberturaConversion?.unresolved || 0}
        clasificacionesNoReconocidas={resumen.metadatos?.clasificacionNoReconocida || 0}
      />

      <CurrencySummaryTable
        data={resumen.resumenPorMoneda?.map((m: any) => ({
          moneda: m.moneda,
          saldoActual: m.saldoActual,
          totalIngresos: m.totalIngresos,
          totalEgresos: m.totalEgresos,
        })) || []}
        monedaPrincipal={monedaPrincipal}
      />

      <AccountingDetailsDisclosure
        sections={[
          {
            id: 'prestamos',
            title: 'Préstamos Cash',
            icon: <Wallet className="h-4 w-4" />,
            content: prestamosCashData ? (
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <span>Activos: <strong className="tabular-nums">{prestamosCashData.totalActivos ?? 0}</strong></span>
                <span>Vencidos: <strong className="tabular-nums">{prestamosCashData.totalVencidos ?? 0}</strong></span>
                <span>Pendiente: <strong className="tabular-nums">{Object.values(prestamosCashData.montoPendienteCobro ?? {}).reduce((sum: number, value) => sum + Number(value), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong></span>
              </div>
            ) : <div className="text-sm text-muted-foreground">Sin datos de préstamos en este período.</div>
          },
          {
            id: 'anticipos',
            title: 'Anticipos',
            icon: <DollarSign className="h-4 w-4" />,
            content: resumenAnticiposData?.resumen ? (
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <span>Total: <strong className="tabular-nums">{Number(resumenAnticiposData.resumen.totalesGenerales?.totalAnticipos ?? Object.values(resumenAnticiposData.resumen.porMoneda ?? {}).reduce((sum: number, value: any) => sum + Number(value?.total ?? 0), 0)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong></span>
                <span>Ejecutado: <strong className="tabular-nums">{Number(resumenAnticiposData.resumen.totalesGenerales?.totalEjecutado ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong></span>
                <span>Pendiente: <strong className="tabular-nums">{Number(resumenAnticiposData.resumen.totalesGenerales?.totalPendiente ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong></span>
              </div>
            ) : <div className="text-sm text-muted-foreground">Sin datos de anticipos en este período.</div>
          },
        ]}
      />
    </motion.div>
  );
}
