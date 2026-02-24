'use client';

import type { JSX } from 'react';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Factory, Play, PlusCircle, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useCreateOrdenProduccionRestauranteMutation,
  useCompletarOrdenProduccionRestauranteMutation,
  useGetOrdenesProduccionRestauranteQuery,
  useGetRecetasRestauranteQuery,
  useIniciarOrdenProduccionRestauranteMutation,
} from '@/lib/redux/services/restauranteRecetasProduccionApi';

/**
 * @description Página de órdenes de producción conectadas a consumo de inventario.
 * @param {Record<string, never>} _props - Sin props para esta página.
 * @returns {JSX.Element} Vista de producción operativa.
 */
export default function RestauranteProduccionPage(
  _props: Record<string, never>
): JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const [recetaId, setRecetaId] = useState<string>('');
  const [cantidad, setCantidad] = useState<string>('1');

  const { data: recetas, isLoading: loadingRecetas } = useGetRecetasRestauranteQuery();
  const { data: ordenes, isLoading: loadingOrdenes } =
    useGetOrdenesProduccionRestauranteQuery();

  const [createOrden, { isLoading: creatingOrden }] =
    useCreateOrdenProduccionRestauranteMutation();
  const [iniciarOrden, { isLoading: startingOrden }] =
    useIniciarOrdenProduccionRestauranteMutation();
  const [completarOrden, { isLoading: completingOrden }] =
    useCompletarOrdenProduccionRestauranteMutation();

  /**
   * @description Crea una orden de producción pendiente.
   * @returns {Promise<void>} Promesa del flujo de creación.
   */
  const handleCreateOrden = async (): Promise<void> => {
    const cantidadValue = Number(cantidad);

    if (!recetaId) {
      toast.error('Seleccione una receta.');
      return;
    }

    if (!Number.isInteger(cantidadValue) || cantidadValue < 1) {
      toast.error('Cantidad inválida.');
      return;
    }

    try {
      await createOrden({ recetaId, cantidad: cantidadValue }).unwrap();
      setCantidad('1');
      toast.success('Orden de producción creada.');
    } catch (error) {
      console.error('Error al crear orden:', error);
      toast.error('No se pudo crear la orden.');
    }
  };

  /**
   * @description Marca una orden pendiente como en proceso.
   * @param {string} ordenProduccionId - Identificador de la orden.
   * @returns {Promise<void>} Promesa del flujo de inicio.
   */
  const handleIniciarOrden = async (ordenProduccionId: string): Promise<void> => {
    try {
      await iniciarOrden({ ordenProduccionId }).unwrap();
      toast.success('Orden iniciada.');
    } catch (error) {
      console.error('Error al iniciar orden:', error);
      toast.error('No se pudo iniciar la orden.');
    }
  };

  /**
   * @description Completa una orden y descuenta inventario.
   * @param {string} ordenProduccionId - Identificador de la orden.
   * @returns {Promise<void>} Promesa del flujo de finalización.
   */
  const handleCompletarOrden = async (
    ordenProduccionId: string
  ): Promise<void> => {
    try {
      await completarOrden({ ordenProduccionId }).unwrap();
      toast.success('Orden completada y stock descontado.');
    } catch (error: unknown) {
      const apiError = (error as { data?: { faltantes?: Array<{ productoNombre: string; faltante: number }> } })?.data;

      if (apiError?.faltantes?.length) {
        const first = apiError.faltantes[0];
        toast.error(
          `Stock insuficiente: ${first.productoNombre} (faltan ${first.faltante}).`
        );
        return;
      }

      console.error('Error al completar orden:', error);
      toast.error('No se pudo completar la orden.');
    }
  };

  return (
    <div className='space-y-4 px-3 py-4 sm:px-4 md:px-6'>
      <motion.header
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: 'easeOut' as const }}
      >
        <h1 className='text-2xl font-semibold'>Producción</h1>
        <p className='text-sm text-muted-foreground'>
          Planifique y ejecute órdenes con control de consumo de inventario.
        </p>
      </motion.header>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Nueva orden de producción</CardTitle>
          <CardDescription>Seleccione receta y cantidad a producir.</CardDescription>
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-3 md:grid-cols-3'>
          <div className='space-y-1'>
            <Label>Receta</Label>
            {loadingRecetas ? (
              <Skeleton className='h-11 w-full rounded-md' />
            ) : (
              <Select value={recetaId} onValueChange={setRecetaId}>
                <SelectTrigger className='h-11'>
                  <SelectValue placeholder='Seleccione receta' />
                </SelectTrigger>
                <SelectContent>
                  {(recetas ?? []).map((receta) => (
                    <SelectItem key={receta.recetaId} value={receta.recetaId}>
                      {receta.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cantidad-produccion'>Cantidad</Label>
            <Input
              id='cantidad-produccion'
              type='number'
              min={1}
              value={cantidad}
              onChange={(event) => setCantidad(event.target.value)}
            />
          </div>

          <div className='flex items-end'>
            <Button
              className='h-11 w-full cursor-pointer'
              onClick={() => void handleCreateOrden()}
              disabled={creatingOrden}
            >
              <PlusCircle className='mr-2 h-4 w-4' />
              Crear orden
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Órdenes de producción</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingOrdenes ? (
            <div className='space-y-2'>
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className='h-20 w-full rounded-lg' />
              ))}
            </div>
          ) : (ordenes?.length ?? 0) === 0 ? (
            <p className='text-sm text-muted-foreground'>No hay órdenes registradas.</p>
          ) : (
            <div className='space-y-3'>
              {ordenes?.map((orden) => (
                <div key={orden.ordenProduccionId} className='rounded-lg border p-3'>
                  <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                    <div>
                      <p className='text-sm font-semibold'>{orden.receta.nombre}</p>
                      <p className='text-xs text-muted-foreground'>
                        Cantidad: {orden.cantidad} | Fecha:{' '}
                        {new Date(orden.fechaProduccion).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <Badge variant='secondary'>{orden.estado}</Badge>
                  </div>

                  <div className='mt-3 flex flex-wrap gap-2'>
                    {orden.estado === 'PENDIENTE' && (
                      <Button
                        size='sm'
                        variant='outline'
                        className='cursor-pointer'
                        onClick={() => void handleIniciarOrden(orden.ordenProduccionId)}
                        disabled={startingOrden}
                      >
                        <Play className='mr-1 h-4 w-4' />
                        Iniciar
                      </Button>
                    )}

                    {(orden.estado === 'PENDIENTE' || orden.estado === 'EN_PROCESO') && (
                      <Button
                        size='sm'
                        className='cursor-pointer'
                        onClick={() => void handleCompletarOrden(orden.ordenProduccionId)}
                        disabled={completingOrden}
                      >
                        <Factory className='mr-1 h-4 w-4' />
                        Completar
                      </Button>
                    )}
                  </div>

                  <div className='mt-3 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground'>
                    <p className='mb-1 font-medium'>Ingredientes requeridos:</p>
                    <div className='space-y-1'>
                      {orden.receta.ingredientes.map((ingrediente) => {
                        const requerido = Math.ceil(
                          ingrediente.cantidad *
                            (1 + ingrediente.desperdicio / 100) *
                            orden.cantidad
                        );

                        const insuficiente = ingrediente.producto.stock < requerido;

                        return (
                          <div
                            key={ingrediente.recetaIngredienteId}
                            className='flex items-center justify-between gap-2'
                          >
                            <span>{ingrediente.producto.nombre}</span>
                            <span
                              className={
                                insuficiente ? 'font-medium text-rose-600' : 'text-muted-foreground'
                              }
                            >
                              Req: {requerido} | Stock: {ingrediente.producto.stock}
                              {insuficiente ? (
                                <ShieldAlert className='ml-1 inline h-3.5 w-3.5' />
                              ) : null}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
