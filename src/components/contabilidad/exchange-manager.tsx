'use client';

import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRightLeft, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useGetMonedasQuery, useGetTasasActualesQuery } from '@/lib/redux/services/contabilidadApi';

import { ConversionDialog } from './conversion-dialog';
import { HistorialTasasTable } from './historial-tasas-table';
import { MonedaForm } from './moneda-form';
import { TasaCambioForm } from './tasa-cambio-form';

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-950/50',
);

const interactiveCardClass = cn(
  surfaceCardClass,
  'transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
);

/**
 * @description Gestor de monedas, tasas de cambio y conversiones del sistema.
 * @returns {JSX.Element} Vista operativa del módulo exchange.
 */
export function ExchangeManager() {
  const shouldReduceMotion = useReducedMotion();
  const [showMonedaForm, setShowMonedaForm] = useState(false);
  const [showTasaForm, setShowTasaForm] = useState(false);
  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [editingMoneda, setEditingMoneda] = useState<any>(null);

  const {
    data: monedasData = [],
    isLoading: loadingMonedas,
    refetch: refetchMonedas,
  } = useGetMonedasQuery();
  const {
    data: tasasActualesData = [],
    isLoading: loadingTasas,
    refetch: refetchTasas,
  } = useGetTasasActualesQuery();

  const monedas = useMemo(() => {
    if (Array.isArray(monedasData)) return monedasData;
    if (Array.isArray((monedasData as any)?.data)) return (monedasData as any).data;
    return Object.values((monedasData as Record<string, unknown>) ?? {});
  }, [monedasData]) as any[];

  const tasasActualesList = useMemo(() => {
    const normalized = Array.isArray(tasasActualesData)
      ? tasasActualesData
      : Array.isArray((tasasActualesData as any)?.data)
        ? (tasasActualesData as any).data
        : Object.values((tasasActualesData as Record<string, unknown>) ?? {});

    return normalized
      .flatMap((item: any) => {
        if (!item) return [];
        if (Array.isArray(item)) return item;
        if (Array.isArray(item?.tasas)) return item.tasas;
        if (item?.tasas) return [item.tasas];
        return [item];
      })
      .filter(Boolean);
  }, [tasasActualesData]) as any[];

  const monedaPrincipal = monedas.find((moneda) => moneda?.esPrincipal);
  const loadingGeneral = loadingMonedas || loadingTasas;

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
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 14 },
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
   * @description Refresca monedas y tasas en paralelo.
   * @returns {Promise<void>} Promesa de actualización.
   */
  const handleRefresh = async (): Promise<void> => {
    try {
      await Promise.all([refetchMonedas(), refetchTasas()]);
      toast.success('Datos actualizados correctamente');
    } catch (error) {
      console.error('Error al actualizar exchange:', error);
      toast.error('Error al actualizar los datos');
    }
  };

  /**
   * @description Abre el formulario de edición para la moneda seleccionada.
   * @param {any} moneda - Moneda a editar.
   * @returns {void} Sin retorno.
   */
  const handleEditMoneda = (moneda: any): void => {
    setEditingMoneda(moneda);
    setShowMonedaForm(true);
  };

  /**
   * @description Cierra el formulario de moneda y limpia edición.
   * @returns {void} Sin retorno.
   */
  const handleCloseMonedaForm = (): void => {
    setShowMonedaForm(false);
    setEditingMoneda(null);
  };

  return (
    <motion.div
      className="space-y-6 p-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={itemVariants}
        className={cn(surfaceCardClass, 'flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between')}
      >
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Gestión de Exchange
          </h2>
          <p className="text-sm text-muted-foreground">
            Administra monedas, tasas vigentes e historial de conversiones.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loadingGeneral}
            className="border-slate-200/60 bg-white/80 shadow-sm hover:bg-slate-100/70 dark:border-slate-800/60 dark:bg-slate-950/70 dark:hover:bg-slate-900"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loadingGeneral && 'animate-spin')} />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={() => setShowConversionDialog(true)}
            className="bg-blue-600 text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Convertir monedas
          </Button>
        </div>
      </motion.div>

      {monedaPrincipal && (
        <motion.div variants={itemVariants}>
          <Card className={surfaceCardClass}>
            <CardHeader>
              <CardTitle className="text-lg">Moneda principal activa</CardTitle>
              <CardDescription>Base para conversiones y reportes.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {monedaPrincipal.nombre}
                  </div>
                  <p className="text-sm text-muted-foreground">Código: {monedaPrincipal.codigo}</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300"
              >
                Símbolo {monedaPrincipal.simbolo}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <Tabs defaultValue="monedas" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-900/70">
            <TabsTrigger value="monedas">Monedas</TabsTrigger>
            <TabsTrigger value="tasas">Tasas de cambio</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="monedas" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Monedas disponibles
              </h3>
              <Button onClick={() => setShowMonedaForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva moneda
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {monedas.map((moneda, index) => (
                <motion.div
                  key={moneda.codigo}
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: shouldReduceMotion ? 0 : index * 0.04 }}
                >
                  <Card className={interactiveCardClass}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{moneda.codigo}</CardTitle>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {moneda.simbolo}
                        </div>
                      </div>
                      <CardDescription>{moneda.nombre}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          {moneda.esPrincipal && (
                            <Badge
                              variant="outline"
                              className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300"
                            >
                              Principal
                            </Badge>
                          )}
                          {!moneda.isActive && (
                            <Badge
                              variant="outline"
                              className="border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
                            >
                              Inactiva
                            </Badge>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleEditMoneda(moneda)}>
                          Editar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {monedas.length === 0 && !loadingMonedas && (
              <Card className={cn(surfaceCardClass, 'border-dashed')}>
                <CardContent className="flex flex-col items-center justify-center gap-4 py-10">
                  <p className="text-sm text-muted-foreground">No hay monedas configuradas.</p>
                  <Button onClick={() => setShowMonedaForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear primera moneda
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="tasas" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Tasas de cambio actuales
              </h3>
              <Button onClick={() => setShowTasaForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Actualizar tasa
              </Button>
            </div>

            <div className="grid gap-4">
              {tasasActualesList.map((tasa, index) => {
                const id = tasa?.tasaId ?? `${tasa?.monedaOrigenId ?? tasa?.monedaOrigen}-${tasa?.monedaDestino ?? 'na'}`;
                const monedaOrigen = tasa?.monedaOrigenId ?? tasa?.monedaOrigen ?? 'N/A';
                const monedaDestino = tasa?.monedaDestino ?? tasa?.monedaDestinoId ?? 'N/A';
                const valor = Number(tasa?.tasa ?? tasa?.valor ?? 0);
                const creadoPor = tasa?.creadoPor ?? tasa?.creador ?? 'Sistema';
                const fecha = tasa?.fechaVigencia ?? tasa?.createdAt ?? null;

                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: shouldReduceMotion ? 0 : index * 0.03 }}
                  >
                    <Card className={interactiveCardClass}>
                      <CardContent className="pt-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ArrowRightLeft className="h-4 w-4" />
                              Par de conversión
                            </div>
                            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                              {monedaOrigen} → {monedaDestino}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Actualizado por: {creadoPor}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                              {valor.toFixed(4)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {fecha ? new Date(fecha).toLocaleString() : 'Sin fecha'}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {tasasActualesList.length === 0 && !loadingTasas && (
              <Card className={cn(surfaceCardClass, 'border-dashed')}>
                <CardContent className="flex flex-col items-center justify-center gap-4 py-10">
                  <p className="text-sm text-muted-foreground">
                    No hay tasas de cambio configuradas.
                  </p>
                  <Button onClick={() => setShowTasaForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Configurar primera tasa
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="historial">
            <Card className={surfaceCardClass}>
              <CardContent className="pt-6">
                <HistorialTasasTable />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {showMonedaForm && (
        <MonedaForm
          moneda={editingMoneda}
          onClose={handleCloseMonedaForm}
          onSuccess={() => {
            handleCloseMonedaForm();
            refetchMonedas();
          }}
        />
      )}

      {showTasaForm && (
        <TasaCambioForm
          onClose={() => setShowTasaForm(false)}
          onSuccess={() => {
            setShowTasaForm(false);
            refetchTasas();
          }}
        />
      )}

      {showConversionDialog && <ConversionDialog onClose={() => setShowConversionDialog(false)} />}
    </motion.div>
  );
}
