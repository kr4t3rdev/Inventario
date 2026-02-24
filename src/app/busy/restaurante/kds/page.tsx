'use client';

import type { JSX } from 'react';
import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Flame, Monitor, UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { EstadoComandaItemRestaurante, KdsComanda } from '@/app/models/model';
import {
  useGetKdsQueueQuery,
  useUpdateKdsItemEstadoMutation,
} from '@/lib/redux/services/restauranteKdsApi';
import { toast } from 'sonner';

const ITEM_ESTADOS: EstadoComandaItemRestaurante[] = ['PENDIENTE', 'EN_PROCESO', 'LISTO', 'SERVIDO'];

/**
 * @description Renderiza el color de prioridad para la cola KDS.
 * @param {KdsComanda['prioridad']} prioridad - Prioridad calculada por tiempo.
 * @returns {string} Clase utilitaria de Tailwind para prioridad.
 */
function getPrioridadClassName(prioridad: KdsComanda['prioridad']): string {
  if (prioridad === 'ALTA') return 'bg-rose-100 text-rose-700';
  if (prioridad === 'MEDIA') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

/**
 * @description Página KDS para cocina con estados de preparación por ítem.
 * @param {Record<string, never>} _props - Sin props para esta página.
 * @returns {JSX.Element} Interfaz KDS para tablet y móvil.
 */
export default function RestauranteKdsPage(_props: Record<string, never>): JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const { data: queue, isLoading, isFetching } = useGetKdsQueueQuery(undefined, {
    pollingInterval: 5000,
  });
  const [updateEstado, { isLoading: updatingEstado }] = useUpdateKdsItemEstadoMutation();

  const resumen = useMemo(() => {
    const comandas = queue ?? [];
    const totalItems = comandas.reduce((acc, comanda) => acc + comanda.itemsPendientes, 0);
    const alta = comandas.filter((comanda) => comanda.prioridad === 'ALTA').length;

    return { comandas: comandas.length, totalItems, alta };
  }, [queue]);

  /**
   * @description Cambia estado de un item en la comanda desde KDS.
   * @param {string} itemId - Identificador del item.
   * @param {EstadoComandaItemRestaurante} estado - Nuevo estado del item.
   * @returns {Promise<void>} Proceso de actualización.
   */
  const handleUpdateEstado = async (
    itemId: string,
    estado: EstadoComandaItemRestaurante
  ): Promise<void> => {
    try {
      await updateEstado({ itemId, estado }).unwrap();
      toast.success(`Ítem actualizado a ${estado}.`);
    } catch (error) {
      console.error('Error actualizando estado en KDS:', error);
      toast.error('No se pudo actualizar el estado del ítem.');
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
          <h1 className='text-2xl font-semibold'>KDS Cocina</h1>
          <p className='text-sm text-muted-foreground'>
            Cola en vivo de comandas abiertas con prioridad por tiempo.
          </p>
        </div>
        <div className='flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm'>
          <Monitor className='h-4 w-4 text-primary' />
          {isFetching ? 'Actualizando...' : 'En línea'}
        </div>
      </motion.header>

      <section className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
        <Card>
          <CardContent className='flex items-center justify-between py-4'>
            <p className='text-sm text-muted-foreground'>Comandas activas</p>
            <p className='text-xl font-semibold'>{resumen.comandas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='flex items-center justify-between py-4'>
            <p className='text-sm text-muted-foreground'>Ítems pendientes</p>
            <p className='text-xl font-semibold'>{resumen.totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='flex items-center justify-between py-4'>
            <p className='text-sm text-muted-foreground'>Prioridad alta</p>
            <p className='flex items-center gap-2 text-xl font-semibold text-rose-600'>
              <Flame className='h-4 w-4' />
              {resumen.alta}
            </p>
          </CardContent>
        </Card>
      </section>

      <ScrollArea className='h-[calc(100vh-17rem)] pr-1'>
        {isLoading ? (
          <div className='space-y-3'>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className='h-52 w-full rounded-xl' />
            ))}
          </div>
        ) : queue && queue.length > 0 ? (
          <div className='grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3'>
            {queue.map((comanda) => (
              <Card key={comanda.comandaId} className='border-border/60'>
                <CardHeader className='space-y-2'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <CardTitle className='text-base'>Mesa #{comanda.mesa.numero}</CardTitle>
                    <Badge className={getPrioridadClassName(comanda.prioridad)}>
                      {comanda.prioridad}
                    </Badge>
                  </div>
                  <CardDescription className='flex items-center justify-between text-xs sm:text-sm'>
                    <span>{comanda.itemsPendientes} ítems pendientes</span>
                    <span>Hace {comanda.elapsedMinutes} min</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {comanda.items.map((item) => (
                    <div key={item.comandaItemId} className='rounded-lg border p-3'>
                      <div className='flex items-start justify-between gap-3'>
                        <div>
                          <p className='font-medium'>{item.plato?.nombre ?? 'Plato'}</p>
                          <p className='text-xs text-muted-foreground'>
                            Cantidad: {item.cantidad}
                          </p>
                        </div>
                        <Badge variant='outline'>{item.estado}</Badge>
                      </div>

                      {item.notas ? (
                        <p className='mt-2 rounded bg-muted px-2 py-1 text-xs'>{item.notas}</p>
                      ) : null}

                      <Separator className='my-2' />
                      <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                        {ITEM_ESTADOS.map((estado) => (
                          <Button
                            key={estado}
                            type='button'
                            size='sm'
                            variant={item.estado === estado ? 'default' : 'outline'}
                            disabled={updatingEstado}
                            onClick={() => handleUpdateEstado(item.comandaItemId, estado)}
                          >
                            {estado === 'EN_PROCESO' ? 'PROCESO' : estado}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <UtensilsCrossed className='h-4 w-4' />
                Sin pendientes en cocina
              </CardTitle>
              <CardDescription>
                No hay comandas activas con ítems pendientes en este momento.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </ScrollArea>
    </div>
  );
}
