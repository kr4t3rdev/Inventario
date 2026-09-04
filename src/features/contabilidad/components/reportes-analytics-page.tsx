'use client';

import { useEffect, useState } from 'react';
import { LazyMotion, m as motion, useReducedMotion } from 'framer-motion';
import { BarChart3, FileText, FilterX, LineChart, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import { AccountTransactionHistory } from './account-transaction-history';
import { DateRangePicker } from './date-range-picker';
import { MovimientosTable } from './movimientos-table';
import { ResumenFinanciero } from './resumen-financiero';
import { ReportFiltersToolbar } from './reportes/ReportFiltersToolbar';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCuentasBancarias } from '@/features/contabilidad/hooks/use-cuentas-bancarias';
import { getMonedasAction } from '@/features/contabilidad/actions-exchange';
import { buildMovimientosExportParams } from '@/features/contabilidad/lib/reportes-filters';
import { getAuthToken } from '@/lib/token';
import { cn } from '@/lib/utils';

interface FiltrosGlobales {
  fechaInicio: string;
  fechaFin: string;
  cuentaId: string;
}

function derivePeriodLabel(fechaInicio?: string, fechaFin?: string): string {
  if (!fechaInicio || !fechaFin) return 'Período completo';
  const start = new Date(fechaInicio);
  const end = new Date(fechaFin);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) return 'Un día';
  if (diffDays <= 7) return 'Una semana';
  if (diffDays <= 31) return 'Un mes';
  if (diffDays <= 92) return 'Un trimestre';
  if (diffDays <= 366) return 'Un año';
  return `${diffDays} días`;
}

interface FiltrosLocalesMovimientos {
  busqueda: string;
  tipoMovimiento: string;
  moneda: string;
  page: number;
  limit: number;
}

const FILTROS_LOCALES_INICIALES: FiltrosLocalesMovimientos = {
  busqueda: '',
  tipoMovimiento: '',
  moneda: '',
  page: 1,
  limit: 10,
};

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

export function ReportesAnalyticsPage() {
  const shouldReduceMotion = useReducedMotion();
  const [tabActiva, setTabActiva] = useState('resumen');
  const [filtrosGlobales, setFiltrosGlobales] = useState<FiltrosGlobales>({
    fechaInicio: '',
    fechaFin: '',
    cuentaId: '',
  });
  const [filtrosLocalesMovimientos, setFiltrosLocalesMovimientos] = useState<FiltrosLocalesMovimientos>(
    FILTROS_LOCALES_INICIALES,
  );
  const [resetMovimientosKey, setResetMovimientosKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [monedas, setMonedas] = useState<Array<{ codigo: string; esPrincipal?: boolean }>>([]);

  const { cuentas } = useCuentasBancarias();
  const cuentaSeleccionada = cuentas.find((cuenta) => cuenta.cuentaId === filtrosGlobales.cuentaId);

  useEffect(() => {
    getMonedasAction().then((result) => {
      if (result.success && Array.isArray(result.data)) setMonedas(result.data);
    }).catch((error) => console.error('Error al cargar monedas del reporte:', error));
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.07,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.3,
        ease: 'easeOut' as const,
      },
    },
  };

  const handleFiltroGlobalChange = (key: keyof FiltrosGlobales, value: string): void => {
    setFiltrosGlobales((prev) => ({ ...prev, [key]: value }));
  };

  const handleDateRangeChange = (fechaInicio: string, fechaFin: string): void => {
    setFiltrosGlobales((prev) => ({ ...prev, fechaInicio, fechaFin }));
  };

  const handleLimpiarFiltros = (): void => {
    setFiltrosGlobales({ fechaInicio: '', fechaFin: '', cuentaId: '' });
    setFiltrosLocalesMovimientos(FILTROS_LOCALES_INICIALES);
    setResetMovimientosKey((prev) => prev + 1);
  };

  const handleLocalFiltersChange = (cambios: Partial<FiltrosLocalesMovimientos>): void => {
    setFiltrosLocalesMovimientos((prev) => ({ ...prev, ...cambios }));
  };

  const handleExportMovimientos = async (tipo: 'csv' | 'pdf'): Promise<void> => {
    try {
      const params = buildMovimientosExportParams(tipo, filtrosGlobales, filtrosLocalesMovimientos);
      const token = getAuthToken();
      const response = await fetch(`/api/contabilidad/reportes/movimientos?${params}`, {
        headers: token ? { Authorization: token } : {},
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Error al exportar movimientos');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `movimientos-${new Date().toISOString().split('T')[0]}.${tipo}`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
      toast.success(`Movimientos exportados en formato ${tipo.toUpperCase()}`);
    } catch (error) {
      console.error('Error al exportar movimientos:', error);
      toast.error('No se pudo exportar el reporte. Intente nuevamente.');
    }
  };

  const periodoString = filtrosGlobales.fechaInicio && filtrosGlobales.fechaFin
    ? `${filtrosGlobales.fechaInicio} al ${filtrosGlobales.fechaFin}`
    : 'Período no seleccionado';

  const monedaPrincipal = monedas.find((moneda) => moneda.esPrincipal)?.codigo
    || monedas[0]?.codigo
    || cuentas[0]?.moneda
    || 'CUP';
  const hasActiveFilters = !!(filtrosGlobales.fechaInicio || filtrosGlobales.fechaFin || filtrosGlobales.cuentaId);

  return (
    <motion.div className="space-y-6 p-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-center">
            <div className="md:col-span-1">
              <DateRangePicker
                fechaInicio={filtrosGlobales.fechaInicio}
                fechaFin={filtrosGlobales.fechaFin}
                onChange={handleDateRangeChange}
              />
            </div>
            <div className="md:col-span-1">
              <Select
                value={filtrosGlobales.cuentaId || 'all'}
                onValueChange={(value) =>
                  handleFiltroGlobalChange('cuentaId', value === 'all' ? '' : value)
                }
              >
                <SelectTrigger aria-label="Filtrar reportes por cuenta bancaria">
                  <SelectValue placeholder="Todas las cuentas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cuentas</SelectItem>
                  {cuentas.map((cuenta) => (
                    <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                      {cuenta.nombreBanco} - {cuenta.numeroCuenta} ({cuenta.moneda})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <ReportFiltersToolbar
                periodo={periodoString}
                cuentaActiva={cuentaSeleccionada?.nombreBanco || 'Todas las cuentas'}
                monedaPrincipal={monedaPrincipal}
                onRefresh={() => setRefreshKey((previous) => previous + 1)}
                onClear={handleLimpiarFiltros}
                hasActiveFilters={hasActiveFilters}
              />
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Tabs value={tabActiva} onValueChange={setTabActiva} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-900/70">
            <TabsTrigger value="resumen" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="movimientos" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Movimientos
            </TabsTrigger>
            <TabsTrigger value="cuenta" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Por cuenta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
            >
              <ResumenFinanciero
                key={refreshKey}
                fechaInicio={filtrosGlobales.fechaInicio}
                fechaFin={filtrosGlobales.fechaFin}
                cuentaId={filtrosGlobales.cuentaId}
                periodo={derivePeriodLabel(filtrosGlobales.fechaInicio, filtrosGlobales.fechaFin)}
                page={1}
                limit={10}
                refreshToken={refreshKey}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="movimientos" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
            >
              <MovimientosTable
                key={refreshKey}
                cuentaId={filtrosGlobales.cuentaId}
                fechaInicio={filtrosGlobales.fechaInicio}
                fechaFin={filtrosGlobales.fechaFin}
                resetKey={resetMovimientosKey}
                onExport={handleExportMovimientos}
                onLocalFiltersChange={handleLocalFiltersChange}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="cuenta" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
            >
              {cuentaSeleccionada ? (
                <AccountTransactionHistory
                  key={refreshKey}
                  cuentaId={cuentaSeleccionada.cuentaId}
                  nombreCuenta={cuentaSeleccionada.nombreBanco}
                  numeroCuenta={cuentaSeleccionada.numeroCuenta}
                  monedaCuenta={cuentaSeleccionada.moneda}
                  fechaInicio={filtrosGlobales.fechaInicio}
                  fechaFin={filtrosGlobales.fechaFin}
                />
              ) : (
                <Card className={cn(surfaceCardClass, 'border-dashed')}>
                  <CardContent className="pt-6">
                    <div className="space-y-3 py-5 text-center">
                      <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                      <div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                          Seleccione una cuenta
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Use el filtro global para cargar su historial detallado.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
