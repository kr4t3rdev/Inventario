'use client';

import type { JSX } from 'react';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useGetComandaRestauranteByIdQuery,
  useReimprimirComandaRestauranteMutation,
} from '@/lib/redux/services/restaurantePosApi';
import { toast } from 'sonner';

/**
 * @description Página imprimible del ticket de una comanda cerrada.
 * @param {Record<string, never>} _props - Sin props para esta página.
 * @returns {JSX.Element} Ticket renderizado para impresión.
 */
export default function RestauranteTicketPage(_props: Record<string, never>): JSX.Element {
  const params = useParams<{ id: string }>();
  const comandaId = params?.id;

  const { data, isLoading } = useGetComandaRestauranteByIdQuery(comandaId ?? '', {
    skip: !comandaId,
  });
  const [reimprimir, { isLoading: reprinting }] = useReimprimirComandaRestauranteMutation();

  const totalItems = useMemo(
    () => data?.items.reduce((acc, item) => acc + item.cantidad, 0) ?? 0,
    [data]
  );

  if (isLoading) {
    return (
      <div className='mx-auto max-w-xl space-y-3 p-4'>
        <Skeleton className='h-10 w-full rounded-md' />
        <Skeleton className='h-72 w-full rounded-md' />
      </div>
    );
  }

  if (!data) {
    return <div className='p-4 text-sm text-muted-foreground'>Comanda no encontrada.</div>;
  }

  const handleRegistrarReimpresion = async (): Promise<void> => {
    if (!comandaId) {
      return;
    }

    try {
      await reimprimir({ comandaId }).unwrap();
      toast.success('Reimpresión registrada.');
    } catch (error) {
      console.error('Error al registrar reimpresión:', error);
      toast.error('No se pudo registrar la reimpresión.');
    }
  };

  return (
    <div className='mx-auto max-w-xl space-y-3 p-4 print:p-0'>
      <div className='flex gap-2 print:hidden'>
        <Button variant='outline' onClick={() => window.history.back()}>
          Volver
        </Button>
        <Button variant='outline' onClick={() => void handleRegistrarReimpresion()} disabled={reprinting}>
          Registrar reimpresión
        </Button>
        <Button onClick={() => window.print()}>Imprimir ticket</Button>
      </div>

      <Card className='print:border-none print:shadow-none'>
        <CardHeader className='space-y-1 text-center'>
          <CardTitle className='text-lg'>Ticket Restaurante</CardTitle>
          <p className='text-xs text-muted-foreground'>Comanda: {data.comandaId}</p>
          <p className='text-xs text-muted-foreground'>Folio: {data.folio ?? 'N/A'}</p>
          <p className='text-xs text-muted-foreground'>
            Reimpresiones: {data.reimpresiones ?? 0}
          </p>
          <p className='text-xs text-muted-foreground'>Mesa: #{data.mesa.numero}</p>
          <p className='text-xs text-muted-foreground'>
            Apertura: {new Date(data.fechaApertura).toLocaleString('es-ES')}
          </p>
          {data.fechaCierre ? (
            <p className='text-xs text-muted-foreground'>
              Cierre: {new Date(data.fechaCierre).toLocaleString('es-ES')}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className='space-y-2'>
          {data.items.map((item) => (
            <div key={item.comandaItemId} className='space-y-1 text-sm'>
              <div className='flex items-center justify-between'>
                <span>
                  {item.cantidad}x {item.plato?.nombre}
                </span>
                <span>${(item.cantidad * item.precioUnitario).toLocaleString()}</span>
              </div>
              <p className='text-xs text-muted-foreground'>${item.precioUnitario.toLocaleString()} c/u</p>
              <Separator />
            </div>
          ))}

          <div className='space-y-1 pt-2 text-sm'>
            <div className='flex items-center justify-between'>
              <span>Items</span>
              <span>{totalItems}</span>
            </div>
            <div className='flex items-center justify-between text-base font-semibold'>
              <span>Total</span>
              <span>${data.total.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
