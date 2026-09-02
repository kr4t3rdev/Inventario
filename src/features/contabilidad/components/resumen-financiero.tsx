'use client';

import { useState, useEffect, useRef } from 'react';
import { m as motion } from 'framer-motion';
import { Wallet, DollarSign } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getVentasPendientesAction,
  getHistorialReconciliacionVentasAction,
  getServiciosPendientesAction,
  getHistorialReconciliacionServiciosAction,
  getGastosPendientesAction,
  getHistorialReconciliacionGastosAction,
} from '@/features/contabilidad/actions-reconciliacion';
import { getPrestamosCashStatsAction } from '@/features/contabilidad/actions-prestamos-cash';
import { getMonedasAction } from '@/features/contabilidad/actions-exchange';
import { getResumenFinancieroAction } from '@/features/contabilidad/actions';
import { getResumenAnticiposAction } from '@/features/contabilidad/actions-anticipos';
import { getSaldoNetoTotal } from '@/features/contabilidad/components/resumen-financiero-utils';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

import { FinancialStatePanel } from './reportes/FinancialStatePanel';
import { AccountingAttentionPanel } from './reportes/AccountingAttentionPanel';
import { CurrencySummaryTable } from './reportes/CurrencySummaryTable';
import { AccountingDetailsDisclosure } from './reportes/AccountingDetailsDisclosure';

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
}

export function ResumenFinanciero({
  fechaInicio,
  fechaFin,
  cuentaId,
  tipoGasto,
  periodo,
  soloNoReconciliados,
  page,
  limit,
  refreshToken = 0,
}: ResumenFinancieroProps): React.JSX.Element | null {
  const { user } = useAuth();
  const hasPrestamosCash = user?.planFeatures?.['prestamos-cash'] === true;
  const hasAnticipos = user?.planFeatures?.['anticipos'] === true;

  const [retryKey, setRetryKey] = useState(0);

  const [resumen, setResumen] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [monedasData, setMonedasData] = useState<any>(null);
  const [historyVentas, setHistoryVentas] = useState<any>(null);
  const [ventasData, setVentasData] = useState<any>(null);
  const [serviciosHistoryData, setServiciosHistoryData] = useState<any>(null);
  const [serviciosData, setServiciosData] = useState<any>(null);
  const [gastosData, setGastosData] = useState<any>(null);
  const [gastosHistoryData, setGastosHistoryData] = useState<any>(null);
  const [resumenAnticiposData, setResumenAnticiposData] = useState<any>(null);
  const [prestamosCashData, setPrestamosCashData] = useState<any>(null);
  const dataRequestRef = useRef(0);

  useEffect(() => {
    const requestId = ++dataRequestRef.current;
    let isActive = true;
    setIsLoading(true);
    setError(null);
    getResumenFinancieroAction({ fechaInicio, fechaFin, cuentaId })
      .then(r => {
        if (!isActive || requestId !== dataRequestRef.current) return;
        if (r.success) {
          setResumen(r.data);
          setIsLoading(false);
        } else {
          setError(r.error);
          setIsLoading(false);
        }
      })
      .catch(e => {
        if (!isActive || requestId !== dataRequestRef.current) return;
        setError(e);
        setIsLoading(false);
      });
    return () => { isActive = false; };
  }, [fechaInicio, fechaFin, cuentaId, retryKey, refreshToken]);

  useEffect(() => {
    let isActive = true;
    getMonedasAction().then(r => { if (isActive && r.success) setMonedasData(r.data); });
    return () => { isActive = false; };
  }, [retryKey, refreshToken]);

  useEffect(() => {
    if (!hasPrestamosCash) return;
    let isActive = true;
    getPrestamosCashStatsAction().then(r => {
      if (isActive && r.success) setPrestamosCashData(r.data);
    }).catch(() => undefined);
    return () => { isActive = false; };
  }, [hasPrestamosCash, retryKey, refreshToken]);

  useEffect(() => {
    if (!hasAnticipos) return;
    let isActive = true;
    getResumenAnticiposAction({ fechaInicio, fechaFin }).then(r => {
      if (isActive && r.success) setResumenAnticiposData(r.data);
    }).catch(() => undefined);
    return () => { isActive = false; };
  }, [fechaInicio, fechaFin, hasAnticipos, retryKey, refreshToken]);

  useEffect(() => {
    getHistorialReconciliacionVentasAction({ fechaInicio, fechaFin, cuentaId })
      .then(r => { if (r.success) setHistoryVentas(r.data) })
      .catch(() => undefined);
  }, [fechaInicio, fechaFin, cuentaId, retryKey, refreshToken]);

  useEffect(() => {
    getVentasPendientesAction({ fechaInicio, fechaFin, page, limit })
      .then(r => { if (r.success) setVentasData(r.data) })
      .catch(() => undefined);
  }, [fechaInicio, fechaFin, page, limit, retryKey, refreshToken]);

  useEffect(() => {
    getHistorialReconciliacionServiciosAction({ fechaDesde: fechaInicio, fechaHasta: fechaFin, cuentaId })
      .then(r => { if (r.success) setServiciosHistoryData(r.data) })
      .catch(() => undefined);
  }, [fechaInicio, fechaFin, cuentaId, retryKey, refreshToken]);

  useEffect(() => {
    getServiciosPendientesAction({ fechaDesde: fechaInicio, fechaHasta: fechaFin, limit, page })
      .then(r => { if (r.success) setServiciosData(r.data) })
      .catch(() => undefined);
  }, [fechaInicio, fechaFin, limit, page, retryKey, refreshToken]);

  useEffect(() => {
    getGastosPendientesAction({
      fechaDesde: fechaInicio,
      fechaHasta: fechaFin,
      tipoGasto,
      soloNoReconciliados,
      page,
      limit,
    })
      .then(r => { if (r.success) setGastosData(r.data) })
      .catch(() => undefined);
  }, [fechaInicio, fechaFin, tipoGasto, soloNoReconciliados, page, limit, retryKey, refreshToken]);

  useEffect(() => {
    getHistorialReconciliacionGastosAction({ fechaInicio, fechaFin, cuentaId, tipoGasto })
      .then(r => { if (r.success) setGastosHistoryData(r.data) })
      .catch(() => undefined);
  }, [fechaInicio, fechaFin, cuentaId, tipoGasto, retryKey, refreshToken]);

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

  const serviciosList = (serviciosData?.ventaServicios || []).filter((servicio: any) => {
    if (!servicio.reconciliaciones || servicio.reconciliaciones.length === 0) return true;
    const totalReconciliado = servicio.reconciliaciones.reduce((sum: number, rec: any) => sum + (rec.montoConvertido || 0), 0);
    return totalReconciliado < (servicio.total || 0);
  });

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-sm text-muted-foreground" aria-label="Período del reporte">
        Período: {periodo}
      </p>
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
        ventasPend={ventasData?.pagination?.total ?? ventasData?.ventas?.length ?? 0}
        serviciosPend={serviciosData?.pagination?.total ?? serviciosList.length}
        gastosPend={gastosData?.pagination?.total ?? gastosData?.gastos?.length ?? 0}
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
                <span>Activos: <strong>{prestamosCashData.totalActivos ?? 0}</strong></span>
                <span>Vencidos: <strong>{prestamosCashData.totalVencidos ?? 0}</strong></span>
                <span>Pendiente: <strong>{Object.values(prestamosCashData.montoPendienteCobro ?? {}).reduce((sum: number, value) => sum + Number(value), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong></span>
              </div>
            ) : <div className="text-sm text-muted-foreground">Sin datos de préstamos en este período.</div>
          },
          {
            id: 'anticipos',
            title: 'Anticipos',
            icon: <DollarSign className="h-4 w-4" />,
            content: resumenAnticiposData?.resumen ? (
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <span>Total: <strong>{Number(resumenAnticiposData.resumen.totalesGenerales?.totalAnticipos ?? Object.values(resumenAnticiposData.resumen.porMoneda ?? {}).reduce((sum: number, value: any) => sum + Number(value?.total ?? 0), 0)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong></span>
                <span>Ejecutado: <strong>{Number(resumenAnticiposData.resumen.totalesGenerales?.totalEjecutado ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong></span>
                <span>Pendiente: <strong>{Number(resumenAnticiposData.resumen.totalesGenerales?.totalPendiente ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong></span>
              </div>
            ) : <div className="text-sm text-muted-foreground">Sin datos de anticipos en este período.</div>
          },
        ]}
      />
    </motion.div>
  );
}
