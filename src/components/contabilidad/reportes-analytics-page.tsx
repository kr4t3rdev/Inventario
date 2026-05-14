'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BarChart3, FileText, FilterX, LineChart, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import { AccountTransactionHistory } from '@/components/contabilidad/account-transaction-history';
import { DateRangePicker } from '@/components/contabilidad/date-range-picker';
import { MovimientosTable } from '@/components/contabilidad/movimientos-table';
import { ResumenFinanciero } from '@/components/contabilidad/resumen-financiero';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGetCuentasBancariasQuery } from '@/features/contabilidad/api/contabilidadApi';
import { useGetPrestamosCashStatsQuery } from '@/lib/redux/services/prestamosCashApi';
import { getAuthToken } from '@/lib/token';
import { cn } from '@/lib/utils';

interface FiltrosGlobales {
  fechaInicio: string;
  fechaFin: string;
  cuentaId: string;
}

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

/**
 * @description Dashboard de reportes contables con filtros globales y vistas por pestañas.
 * @returns {JSX.Element} Contenido analítico de reportes financieros.
 */
export function ReportesAnalyticsPage() {
  const shouldReduceMotion = useReducedMotion();
  const [tabActiva, setTabActiva] = useState('resumen');
  const [filtrosGlobales, setFiltrosGlobales] = useState<FiltrosGlobales>({
    fechaInicio: '',
    fechaFin: '',
    cuentaId: '',
  });

  const { data: cuentasData = { cuentas: [] } } = useGetCuentasBancariasQuery();
  const cuentas = cuentasData.cuentas ?? [];
  const cuentaSeleccionada = cuentas.find((cuenta) => cuenta.cuentaId === filtrosGlobales.cuentaId);
  const { data: prestamosStats } = useGetPrestamosCashStatsQuery();
  const saldoPendientePrestamos = Object.values(prestamosStats?.montoPendienteCobro ?? {}).reduce(
    (acc, value) => acc + value,
    0,
  );

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

  /**
   * @description Actualiza un filtro global de reportes.
   * @param {keyof FiltrosGlobales} key - Campo de filtro a actualizar.
   * @param {string} value - Nuevo valor del filtro.
   * @returns {void} Sin retorno.
   */
  const handleFiltroGlobalChange = (key: keyof FiltrosGlobales, value: string): void => {
    setFiltrosGlobales((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * @description Aplica un rango de fecha global para todas las pestañas.
   * @param {string} fechaInicio - Fecha inicial.
   * @param {string} fechaFin - Fecha final.
   * @returns {void} Sin retorno.
   */
  const handleDateRangeChange = (fechaInicio: string, fechaFin: string): void => {
    setFiltrosGlobales((prev) => ({ ...prev, fechaInicio, fechaFin }));
  };

  /**
   * @description Exporta movimientos filtrados en formato CSV o PDF.
   * @param {'csv' | 'pdf'} tipo - Formato de exportación.
   * @returns {Promise<void>} Promesa de ejecución de descarga.
   */
  const handleExportMovimientos = async (tipo: 'csv' | 'pdf'): Promise<void> => {
    try {
      const params = new URLSearchParams({
        formato: tipo,
        ...(filtrosGlobales.fechaInicio && { fechaInicio: filtrosGlobales.fechaInicio }),
        ...(filtrosGlobales.fechaFin && { fechaFin: filtrosGlobales.fechaFin }),
        ...(filtrosGlobales.cuentaId && { cuentaId: filtrosGlobales.cuentaId }),
      });

      const token = getAuthToken();
      const response = await fetch(`/api/contabilidad/reportes/movimientos?${params}`, {
        headers: token ? { Authorization: token } : {},
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Error al exportar movimientos');
      }

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

  return (
    <motion.div className="space-y-6 p-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants} className={cn(surfaceCardClass, 'flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between')}>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Explorador de Reportes
          </h2>
          <p className="text-sm text-muted-foreground">
            Use filtros globales para mantener consistencia entre resumen, movimientos y detalle por cuenta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Tab activa: {tabActiva}</Badge>
          <Badge variant="outline">{cuentas.length} cuentas disponibles</Badge>
          <Badge variant="outline">Préstamos pendientes: {saldoPendientePrestamos.toFixed(2)}</Badge>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className={surfaceCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LineChart className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              Filtros globales
            </CardTitle>
            <CardDescription>Se aplican automáticamente en todas las pestañas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <DateRangePicker
                fechaInicio={filtrosGlobales.fechaInicio}
                fechaFin={filtrosGlobales.fechaFin}
                onChange={handleDateRangeChange}
              />

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

              <Button
                variant="outline"
                onClick={() => setFiltrosGlobales({ fechaInicio: '', fechaFin: '', cuentaId: '' })}
              >
                <FilterX className="mr-2 h-4 w-4" />
                Limpiar filtros
              </Button>
            </div>
          </CardContent>
        </Card>
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
                fechaInicio={filtrosGlobales.fechaInicio}
                fechaFin={filtrosGlobales.fechaFin}
                cuentaId={filtrosGlobales.cuentaId}
                periodo="mes"
                page={1}
                limit={10}
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
                cuentaId={filtrosGlobales.cuentaId}
                fechaInicio={filtrosGlobales.fechaInicio}
                fechaFin={filtrosGlobales.fechaFin}
                onExport={handleExportMovimientos}
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
                  cuentaId={cuentaSeleccionada.cuentaId}
                  nombreCuenta={cuentaSeleccionada.nombreBanco}
                  numeroCuenta={cuentaSeleccionada.numeroCuenta}
                  monedaCuenta={cuentaSeleccionada.moneda}
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
