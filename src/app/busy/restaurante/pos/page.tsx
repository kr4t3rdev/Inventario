'use client';

import type { JSX } from 'react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Calculator,
  ExternalLink,
  Plus,
  ReceiptText,
  ShoppingCart,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetMesasRestauranteQuery } from '@/lib/redux/services/mesasRestauranteApi';
import {
  useAddItemComandaRestauranteMutation,
  useAnularItemComandaRestauranteMutation,
  useCheckoutComandaRestauranteMutation,
  useCreateComandaRestauranteMutation,
  useGetComandasRestauranteQuery,
  useGetPlatosRestauranteQuery,
} from '@/lib/redux/services/restaurantePosApi';
import { toast } from 'sonner';

interface CheckoutDraft {
  splitCount: string;
  descuento: string;
  propina: string;
  efectivo: string;
  tarjeta: string;
  transferencia: string;
}

const INITIAL_CHECKOUT_DRAFT: CheckoutDraft = {
  splitCount: '1',
  descuento: '0',
  propina: '0',
  efectivo: '0',
  tarjeta: '0',
  transferencia: '0',
};

/**
 * @description Página POS para operar comandas por mesa en restaurante.
 * @param {Record<string, never>} _props - Sin props para esta página.
 * @returns {JSX.Element} Interfaz POS de restaurante optimizada para tablet/móvil.
 */
export default function RestaurantePosPage(_props: Record<string, never>): JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null);
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft>(INITIAL_CHECKOUT_DRAFT);
  const [lastClosedComandaId, setLastClosedComandaId] = useState<string | null>(null);

  const { data: mesas, isLoading: loadingMesas } = useGetMesasRestauranteQuery();
  const { data: platos, isLoading: loadingPlatos } = useGetPlatosRestauranteQuery({
    disponible: true,
  });
  const { data: comandas, isLoading: loadingComandas } = useGetComandasRestauranteQuery({
    estado: 'ABIERTA',
  });

  const [createComanda, { isLoading: creatingComanda }] =
    useCreateComandaRestauranteMutation();
  const [addItem, { isLoading: addingItem }] = useAddItemComandaRestauranteMutation();
  const [anularItem, { isLoading: anulandoItem }] = useAnularItemComandaRestauranteMutation();
  const [checkoutComanda, { isLoading: checkingOut }] =
    useCheckoutComandaRestauranteMutation();

  const mesasOrdenadas = useMemo(
    () => [...(mesas ?? [])].sort((a, b) => a.numero - b.numero),
    [mesas]
  );

  const selectedMesa = useMemo(
    () => mesasOrdenadas.find((mesa) => mesa.mesaId === selectedMesaId) ?? null,
    [mesasOrdenadas, selectedMesaId]
  );

  const selectedComanda = useMemo(() => {
    if (!selectedMesaId) {
      return null;
    }

    return comandas?.find((comanda) => comanda.mesaId === selectedMesaId) ?? null;
  }, [comandas, selectedMesaId]);

  const totalItems = useMemo(() => {
    if (!selectedComanda) {
      return 0;
    }

    return selectedComanda.items.reduce((acc, item) => acc + item.cantidad, 0);
  }, [selectedComanda]);

  const checkoutPreview = useMemo(() => {
    const totalOriginal = selectedComanda?.total ?? 0;
    const descuento = Number(checkoutDraft.descuento) || 0;
    const propina = Number(checkoutDraft.propina) || 0;
    const splitCount = Math.max(1, Number(checkoutDraft.splitCount) || 1);

    const totalAPagar = totalOriginal - descuento + propina;
    const pagoEfectivo = Number(checkoutDraft.efectivo) || 0;
    const pagoTarjeta = Number(checkoutDraft.tarjeta) || 0;
    const pagoTransferencia = Number(checkoutDraft.transferencia) || 0;
    const totalPagado = pagoEfectivo + pagoTarjeta + pagoTransferencia;

    return {
      totalOriginal,
      descuento,
      propina,
      splitCount,
      totalAPagar,
      totalPagado,
      totalPorPersona: Math.ceil(Math.max(0, totalAPagar) / splitCount),
      pagoEfectivo,
      pagoTarjeta,
      pagoTransferencia,
    };
  }, [selectedComanda, checkoutDraft]);

  /**
   * @description Abre una comanda para la mesa seleccionada.
   * @returns {Promise<void>} Promesa del flujo de apertura.
   */
  const handleOpenComanda = async (): Promise<void> => {
    if (!selectedMesaId) {
      toast.error('Seleccione una mesa para abrir comanda.');
      return;
    }

    try {
      await createComanda({ mesaId: selectedMesaId }).unwrap();
      toast.success('Comanda abierta correctamente.');
    } catch (error) {
      console.error('Error al abrir comanda:', error);
      toast.error('No se pudo abrir la comanda.');
    }
  };

  /**
   * @description Agrega un plato a la comanda activa.
   * @param {string} platoId - Identificador del plato a agregar.
   * @returns {Promise<void>} Promesa del flujo de agregado.
   */
  const handleAddPlato = async (platoId: string): Promise<void> => {
    if (!selectedComanda) {
      toast.error('Primero abra una comanda para esta mesa.');
      return;
    }

    try {
      await addItem({
        comandaId: selectedComanda.comandaId,
        platoId,
        cantidad: 1,
      }).unwrap();
      toast.success('Plato agregado a la comanda.');
    } catch (error) {
      console.error('Error al agregar plato:', error);
      toast.error('No se pudo agregar el plato.');
    }
  };

  /**
   * @description Anula una unidad de un ítem de comanda activa.
   * @param {string} itemId - Identificador del item de comanda.
   * @returns {Promise<void>} Promesa del flujo de anulación.
   */
  const handleAnularUnaUnidad = async (itemId: string): Promise<void> => {
    if (!selectedComanda) {
      toast.error('No hay comanda activa para ajustar.');
      return;
    }

    try {
      await anularItem({
        comandaId: selectedComanda.comandaId,
        itemId,
        cantidad: 1,
        motivo: 'Anulación parcial desde POS',
      }).unwrap();
      toast.success('Se anuló una unidad del ítem.');
    } catch (error) {
      console.error('Error al anular ítem:', error);
      toast.error('No se pudo anular el ítem.');
    }
  };

  /**
   * @description Cobra y cierra una comanda usando pago mixto y división.
   * @returns {Promise<void>} Promesa del flujo de checkout.
   */
  const handleCheckoutComanda = async (): Promise<void> => {
    if (!selectedComanda) {
      toast.error('No hay comanda abierta para cobrar.');
      return;
    }

    if (checkoutPreview.totalAPagar < 0) {
      toast.error('El descuento no puede dejar total negativo.');
      return;
    }

    if (checkoutPreview.totalPagado !== checkoutPreview.totalAPagar) {
      toast.error('La suma de pagos debe coincidir con el total a pagar.');
      return;
    }

    try {
      await checkoutComanda({
        comandaId: selectedComanda.comandaId,
        splitCount: checkoutPreview.splitCount,
        descuento: checkoutPreview.descuento,
        propina: checkoutPreview.propina,
        pagos: [
          { metodo: 'EFECTIVO', monto: checkoutPreview.pagoEfectivo },
          { metodo: 'TARJETA', monto: checkoutPreview.pagoTarjeta },
          { metodo: 'TRANSFERENCIA', monto: checkoutPreview.pagoTransferencia },
        ],
      }).unwrap();

      setLastClosedComandaId(selectedComanda.comandaId);
      setCheckoutDraft(INITIAL_CHECKOUT_DRAFT);
      toast.success('Comanda cobrada y cerrada correctamente.');
    } catch (error) {
      console.error('Error al cobrar comanda:', error);
      toast.error('No se pudo cerrar la comanda.');
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
          <h1 className='text-2xl font-semibold'>POS Restaurante</h1>
          <p className='text-sm text-muted-foreground'>
            Seleccione mesa, agregue platos y cierre con pago mixto.
          </p>
        </div>
        <Button asChild variant='outline' className='h-11 w-full sm:w-auto'>
          <Link href='/busy/restaurante/caja'>
            <Calculator className='mr-2 h-4 w-4' />
            Cierre de caja
          </Link>
        </Button>
      </motion.header>

      <div className='grid grid-cols-1 gap-4 xl:grid-cols-12'>
        <Card className='xl:col-span-4'>
          <CardHeader>
            <CardTitle className='text-base'>Mesas</CardTitle>
            <CardDescription>Toque una mesa para operar su comanda.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMesas ? (
              <div className='space-y-2'>
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className='h-16 w-full rounded-lg' />
                ))}
              </div>
            ) : (
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                {mesasOrdenadas.map((mesa) => {
                  const isSelected = mesa.mesaId === selectedMesaId;
                  const hasOpenComanda = comandas?.some(
                    (comanda) => comanda.mesaId === mesa.mesaId
                  );

                  return (
                    <button
                      key={mesa.mesaId}
                      type='button'
                      className={`min-h-14 rounded-lg border px-2 py-2 text-left transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedMesaId(mesa.mesaId)}
                    >
                      <p className='text-sm font-semibold'>Mesa #{mesa.numero}</p>
                      <p className='text-xs text-muted-foreground'>Cap. {mesa.capacidad}</p>
                      <p
                        className={`mt-1 text-xs font-medium ${
                          hasOpenComanda ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {hasOpenComanda ? 'Con comanda' : 'Disponible'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className='xl:col-span-4'>
          <CardHeader>
            <CardTitle className='text-base'>Comanda Activa</CardTitle>
            <CardDescription>
              {selectedMesa
                ? `Mesa #${selectedMesa.numero}`
                : 'Seleccione una mesa para comenzar.'}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {!selectedMesa ? (
              <p className='text-sm text-muted-foreground'>Sin mesa seleccionada.</p>
            ) : !selectedComanda ? (
              <div className='space-y-3'>
                <p className='text-sm text-muted-foreground'>
                  No hay comanda abierta para esta mesa.
                </p>
                {lastClosedComandaId ? (
                  <Button asChild variant='outline' className='h-11 w-full cursor-pointer'>
                    <Link href={`/busy/restaurante/ticket/${lastClosedComandaId}`}>
                      <ExternalLink className='mr-2 h-4 w-4' />
                      Ver último ticket
                    </Link>
                  </Button>
                ) : null}
                <Button
                  className='h-11 w-full cursor-pointer'
                  onClick={() => void handleOpenComanda()}
                  disabled={creatingComanda}
                >
                  <Plus className='mr-2 h-4 w-4' />
                  Abrir comanda
                </Button>
              </div>
            ) : (
              <>
                <div className='grid grid-cols-2 gap-2 rounded-lg border p-3'>
                  <div>
                    <p className='text-xs text-muted-foreground'>Total</p>
                    <p className='text-lg font-semibold'>${selectedComanda.total.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className='text-xs text-muted-foreground'>Items</p>
                    <p className='text-lg font-semibold'>{totalItems}</p>
                  </div>
                </div>

                <ScrollArea className='h-52 rounded-lg border p-3'>
                  {selectedComanda.items.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>Sin productos agregados.</p>
                  ) : (
                    <div className='space-y-3'>
                      {selectedComanda.items.map((item) => (
                        <div key={item.comandaItemId} className='space-y-1'>
                          <div className='flex items-center justify-between gap-2'>
                            <p className='text-sm font-medium'>
                              {item.cantidad}x {item.plato?.nombre}
                            </p>
                            <Button
                              size='sm'
                              variant='outline'
                              className='h-7 px-2 text-xs'
                              onClick={() => void handleAnularUnaUnidad(item.comandaItemId)}
                              disabled={anulandoItem}
                            >
                              -1
                            </Button>
                          </div>
                          <p className='text-xs text-muted-foreground'>
                            ${item.precioUnitario.toLocaleString()} c/u
                          </p>
                          <Separator />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <div className='space-y-2 rounded-lg border p-3'>
                  <p className='text-sm font-semibold'>Checkout</p>
                  <Button asChild variant='outline' className='h-9 w-full'>
                    <Link href={`/busy/restaurante/ticket/${selectedComanda.comandaId}`}>
                      <ExternalLink className='mr-2 h-4 w-4' />
                      Ver ticket (preimpresión)
                    </Link>
                  </Button>

                  <div className='grid grid-cols-3 gap-2'>
                    <div className='space-y-1'>
                      <Label htmlFor='split-count'>Dividir</Label>
                      <Input
                        id='split-count'
                        type='number'
                        min={1}
                        value={checkoutDraft.splitCount}
                        onChange={(event) =>
                          setCheckoutDraft((prev) => ({ ...prev, splitCount: event.target.value }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label htmlFor='descuento'>Descuento</Label>
                      <Input
                        id='descuento'
                        type='number'
                        min={0}
                        value={checkoutDraft.descuento}
                        onChange={(event) =>
                          setCheckoutDraft((prev) => ({ ...prev, descuento: event.target.value }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label htmlFor='propina'>Propina</Label>
                      <Input
                        id='propina'
                        type='number'
                        min={0}
                        value={checkoutDraft.propina}
                        onChange={(event) =>
                          setCheckoutDraft((prev) => ({ ...prev, propina: event.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className='grid grid-cols-3 gap-2'>
                    <div className='space-y-1'>
                      <Label htmlFor='pago-efectivo'>Efectivo</Label>
                      <Input
                        id='pago-efectivo'
                        type='number'
                        min={0}
                        value={checkoutDraft.efectivo}
                        onChange={(event) =>
                          setCheckoutDraft((prev) => ({ ...prev, efectivo: event.target.value }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label htmlFor='pago-tarjeta'>Tarjeta</Label>
                      <Input
                        id='pago-tarjeta'
                        type='number'
                        min={0}
                        value={checkoutDraft.tarjeta}
                        onChange={(event) =>
                          setCheckoutDraft((prev) => ({ ...prev, tarjeta: event.target.value }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label htmlFor='pago-transferencia'>Transferencia</Label>
                      <Input
                        id='pago-transferencia'
                        type='number'
                        min={0}
                        value={checkoutDraft.transferencia}
                        onChange={(event) =>
                          setCheckoutDraft((prev) => ({ ...prev, transferencia: event.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className='rounded-md bg-muted/40 p-2 text-xs'>
                    <p>Total a pagar: ${checkoutPreview.totalAPagar.toLocaleString()}</p>
                    <p>Total pagado: ${checkoutPreview.totalPagado.toLocaleString()}</p>
                    <p>Por persona: ${checkoutPreview.totalPorPersona.toLocaleString()}</p>
                  </div>

                  <Button
                    className='h-11 w-full cursor-pointer'
                    onClick={() => void handleCheckoutComanda()}
                    disabled={checkingOut}
                  >
                    <ReceiptText className='mr-2 h-4 w-4' />
                    Cobrar y cerrar comanda
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className='xl:col-span-4'>
          <CardHeader>
            <CardTitle className='text-base'>Platos Disponibles</CardTitle>
            <CardDescription>Agregar con un toque a la comanda activa.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPlatos || loadingComandas ? (
              <div className='space-y-2'>
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className='h-14 w-full rounded-lg' />
                ))}
              </div>
            ) : (platos?.length ?? 0) === 0 ? (
              <div className='rounded-lg border border-dashed p-6 text-center'>
                <UtensilsCrossed className='mx-auto h-6 w-6 text-muted-foreground' />
                <p className='mt-2 text-sm text-muted-foreground'>No hay platos disponibles.</p>
              </div>
            ) : (
              <ScrollArea className='h-[420px] pr-2'>
                <div className='space-y-2'>
                  {platos?.map((plato) => (
                    <button
                      key={plato.platoId}
                      type='button'
                      className='w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/60'
                      onClick={() => void handleAddPlato(plato.platoId)}
                      disabled={!selectedComanda || addingItem}
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <div>
                          <p className='text-sm font-medium'>{plato.nombre}</p>
                          <p className='text-xs text-muted-foreground'>{plato.tipoPlato}</p>
                        </div>
                        <div className='flex items-center gap-2'>
                          <span className='text-sm font-semibold'>
                            ${plato.precio.toLocaleString()}
                          </span>
                          <ShoppingCart className='h-4 w-4 text-primary' />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
