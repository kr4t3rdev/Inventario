'use client';

import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarCheck2, RotateCcw, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAbrirTurnoCajaRestauranteMutation,
  useCerrarCajaRestauranteMutation,
  useCerrarTurnoCajaRestauranteMutation,
  useGetCierresCajaRestauranteQuery,
  useGetResumenCajaRestauranteQuery,
  useGetTurnosCajaRestauranteQuery,
  useReabrirCierreCajaRestauranteMutation,
} from '@/lib/redux/services/restauranteCajaApi';
import { toast } from 'sonner';

/**
 * @description Convierte fecha local de input datetime-local a ISO.
 * @param {string} value - Valor datetime-local.
 * @returns {string} Fecha ISO.
 */
function localDateTimeToIso(value: string): string {
  return new Date(value).toISOString();
}

/**
 * @description Vista de resumen y cierre de caja para POS restaurante.
 * @param {Record<string, never>} _props - Sin props para esta página.
 * @returns {JSX.Element} Pantalla de cierre de caja.
 */
export default function RestauranteCajaPage(_props: Record<string, never>): JSX.Element {
  const shouldReduceMotion = useReducedMotion();

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setHours(0, 0, 0, 0);

  const defaultEnd = new Date(now);
  defaultEnd.setHours(23, 59, 0, 0);

  const [fechaInicioLocal, setFechaInicioLocal] = useState<string>(
    defaultStart.toISOString().slice(0, 16)
  );
  const [fechaFinLocal, setFechaFinLocal] = useState<string>(
    defaultEnd.toISOString().slice(0, 16)
  );
  const [observaciones, setObservaciones] = useState<string>('');
  const [reabrirMotivo, setReabrirMotivo] = useState<string>('');
  const [selectedCierreId, setSelectedCierreId] = useState<string>('');

  const fechaInicioIso = useMemo(
    () => localDateTimeToIso(fechaInicioLocal),
    [fechaInicioLocal]
  );
  const fechaFinIso = useMemo(() => localDateTimeToIso(fechaFinLocal), [fechaFinLocal]);

  const { data: resumen, isLoading } = useGetResumenCajaRestauranteQuery({
    fechaInicio: fechaInicioIso,
    fechaFin: fechaFinIso,
  });
  const { data: cierres, isLoading: loadingCierres } = useGetCierresCajaRestauranteQuery({
    limit: 15,
  });
  const { data: turnosData, isLoading: loadingTurnos } = useGetTurnosCajaRestauranteQuery();

  const [cerrarCaja, { isLoading: closingCaja }] = useCerrarCajaRestauranteMutation();
  const [abrirTurno, { isLoading: openingTurno }] = useAbrirTurnoCajaRestauranteMutation();
  const [cerrarTurno, { isLoading: closingTurno }] = useCerrarTurnoCajaRestauranteMutation();
  const [reabrirCierre, { isLoading: reopeningCierre }] =
    useReabrirCierreCajaRestauranteMutation();

  /**
   * @description Ejecuta cierre contable de caja con el rango seleccionado.
   * @returns {Promise<void>} Promesa del flujo de cierre.
   */
  const handleCerrarCaja = async (): Promise<void> => {
    try {
      await cerrarCaja({
        fechaInicio: fechaInicioIso,
        fechaFin: fechaFinIso,
        observaciones,
      }).unwrap();

      toast.success('Cierre de caja generado correctamente.');
      setObservaciones('');
    } catch (error) {
      console.error('Error al cerrar caja:', error);
      toast.error('No se pudo cerrar la caja.');
    }
  };

  /**
   * @description Reabre un cierre POS seleccionado con motivo obligatorio.
   * @returns {Promise<void>} Promesa del flujo de reapertura.
   */
  const handleReabrirCierre = async (): Promise<void> => {
    if (!selectedCierreId) {
      toast.error('Seleccione un cierre del histórico.');
      return;
    }

    if (reabrirMotivo.trim().length < 5) {
      toast.error('Debe indicar un motivo de al menos 5 caracteres.');
      return;
    }

    try {
      await reabrirCierre({
        cierreId: selectedCierreId,
        motivo: reabrirMotivo.trim(),
      }).unwrap();

      toast.success('Cierre reabierto correctamente.');
      setReabrirMotivo('');
    } catch (error) {
      console.error('Error al reabrir cierre:', error);
      toast.error('No se pudo reabrir el cierre.');
    }
  };

  /**
   * @description Abre turno de cajero en POS restaurante.
   * @returns {Promise<void>} Promesa del flujo de apertura.
   */
  const handleAbrirTurno = async (): Promise<void> => {
    try {
      await abrirTurno({ observaciones: 'Apertura desde módulo caja POS' }).unwrap();
      toast.success('Turno abierto.');
    } catch (error) {
      console.error('Error al abrir turno:', error);
      toast.error('No se pudo abrir el turno.');
    }
  };

  /**
   * @description Cierra turno de cajero con resumen automático.
   * @returns {Promise<void>} Promesa del flujo de cierre.
   */
  const handleCerrarTurno = async (): Promise<void> => {
    try {
      await cerrarTurno({ observaciones: 'Cierre desde módulo caja POS' }).unwrap();
      toast.success('Turno cerrado correctamente.');
    } catch (error) {
      console.error('Error al cerrar turno:', error);
      toast.error('No se pudo cerrar el turno.');
    }
  };

  return (
    <div className='space-y-4 px-3 py-4 sm:px-4 md:px-6'>
      <motion.header
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: 'easeOut' as const }}
        className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
      >
        <div>
          <h1 className='text-2xl font-semibold'>Cierre de Caja POS</h1>
          <p className='text-sm text-muted-foreground'>
            Resumen por método de pago y cierre contable del restaurante.
          </p>
        </div>
        <Button asChild variant='outline' className='h-11 w-full sm:w-auto'>
          <Link href='/busy/restaurante/pos'>Volver a POS</Link>
        </Button>
      </motion.header>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Corte de turno por cajero</CardTitle>
          <CardDescription>
            Control de apertura/cierre de turno para operaciones de caja.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          {loadingTurnos ? (
            <Skeleton className='h-20 w-full rounded-lg' />
          ) : (
            <>
              <div className='rounded-lg border p-3 text-sm'>
                <p className='font-medium'>Estado actual</p>
                {turnosData?.turnoActivo ? (
                  <p className='text-muted-foreground'>
                    Turno abierto desde{' '}
                    {new Date(turnosData.turnoActivo.fechaInicio).toLocaleString('es-ES')}
                  </p>
                ) : (
                  <p className='text-muted-foreground'>No hay turno abierto.</p>
                )}
              </div>

              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                <Button
                  variant='outline'
                  className='h-11 w-full'
                  onClick={() => void handleAbrirTurno()}
                  disabled={openingTurno || Boolean(turnosData?.turnoActivo)}
                >
                  Abrir turno
                </Button>
                <Button
                  className='h-11 w-full'
                  onClick={() => void handleCerrarTurno()}
                  disabled={closingTurno || !turnosData?.turnoActivo}
                >
                  Cerrar turno
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Rango de cierre</CardTitle>
          <CardDescription>Defina fecha inicio y fecha fin del turno o día.</CardDescription>
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-3 md:grid-cols-3'>
          <div className='space-y-1'>
            <Label htmlFor='fecha-inicio'>Fecha inicio</Label>
            <Input
              id='fecha-inicio'
              type='datetime-local'
              value={fechaInicioLocal}
              onChange={(event) => setFechaInicioLocal(event.target.value)}
            />
          </div>

          <div className='space-y-1'>
            <Label htmlFor='fecha-fin'>Fecha fin</Label>
            <Input
              id='fecha-fin'
              type='datetime-local'
              value={fechaFinLocal}
              onChange={(event) => setFechaFinLocal(event.target.value)}
            />
          </div>

          <div className='flex items-end'>
            <Button className='h-11 w-full cursor-pointer' onClick={() => void handleCerrarCaja()}>
              <CalendarCheck2 className='mr-2 h-4 w-4' />
              Cerrar caja
            </Button>
          </div>

          <div className='space-y-1 md:col-span-3'>
            <Label htmlFor='observaciones-cierre'>Observaciones</Label>
            <Input
              id='observaciones-cierre'
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              placeholder='Opcional: incidencias del turno'
            />
          </div>
        </CardContent>
      </Card>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className='h-28 w-full rounded-lg' />
          ))
        ) : (
          <>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm text-muted-foreground'>Comandas</CardTitle>
              </CardHeader>
              <CardContent className='text-2xl font-semibold'>
                {resumen?.totalComandas ?? 0}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm text-muted-foreground'>Facturado</CardTitle>
              </CardHeader>
              <CardContent className='text-2xl font-semibold'>
                ${(resumen?.totalFacturado ?? 0).toLocaleString()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm text-muted-foreground'>Efectivo</CardTitle>
              </CardHeader>
              <CardContent className='text-2xl font-semibold text-emerald-700'>
                ${(resumen?.porMetodo.efectivo ?? 0).toLocaleString()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm text-muted-foreground'>Tarjeta</CardTitle>
              </CardHeader>
              <CardContent className='text-2xl font-semibold text-blue-700'>
                ${(resumen?.porMetodo.tarjeta ?? 0).toLocaleString()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm text-muted-foreground'>Transferencia</CardTitle>
              </CardHeader>
              <CardContent className='text-2xl font-semibold text-violet-700'>
                ${(resumen?.porMetodo.transferencia ?? 0).toLocaleString()}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>No clasificado</CardTitle>
          <CardDescription>
            Comandas cerradas sin metadatos de checkout (cierres antiguos/manuales).
          </CardDescription>
        </CardHeader>
        <CardContent className='flex items-center gap-2 text-lg font-semibold'>
          <Wallet className='h-5 w-5 text-muted-foreground' />
          ${(resumen?.porMetodo.noClasificado ?? 0).toLocaleString()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Histórico de cierres POS</CardTitle>
          <CardDescription>Últimos cierres generados desde este módulo.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          {loadingCierres ? (
            <div className='space-y-2'>
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className='h-16 w-full rounded-lg' />
              ))}
            </div>
          ) : (cierres?.length ?? 0) === 0 ? (
            <p className='text-sm text-muted-foreground'>Sin cierres registrados.</p>
          ) : (
            <div className='space-y-2'>
              {cierres?.map((cierre) => (
                <button
                  key={cierre.cierreId}
                  type='button'
                  className={`w-full rounded-lg border p-3 text-left ${
                    selectedCierreId === cierre.cierreId
                      ? 'border-primary bg-primary/10'
                      : 'border-border'
                  }`}
                  onClick={() => setSelectedCierreId(cierre.cierreId)}
                >
                  <p className='text-sm font-medium'>
                    {new Date(cierre.createdAt).toLocaleString('es-ES')}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    Estado: {cierre.estado} | Ventas: ${Number(cierre.totalVentas).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}

          <div className='space-y-1'>
            <Label htmlFor='motivo-reabrir'>Motivo de reapertura</Label>
            <Input
              id='motivo-reabrir'
              value={reabrirMotivo}
              onChange={(event) => setReabrirMotivo(event.target.value)}
              placeholder='Ej: corrección de pago mixto mal registrado'
            />
          </div>

          <Button
            variant='outline'
            className='h-11 w-full cursor-pointer'
            onClick={() => void handleReabrirCierre()}
            disabled={reopeningCierre}
          >
            <RotateCcw className='mr-2 h-4 w-4' />
            Reabrir cierre seleccionado
          </Button>
        </CardContent>
      </Card>

      {closingCaja ? <p className='text-xs text-muted-foreground'>Generando cierre...</p> : null}
    </div>
  );
}
