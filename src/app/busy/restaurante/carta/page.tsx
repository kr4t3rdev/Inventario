'use client';

import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, Utensils } from 'lucide-react';
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
import {
  useCreatePlatoRestauranteMutation,
  useGetPlatosRestauranteQuery,
} from '@/lib/redux/services/restaurantePosApi';
import { TipoPlatoRestaurante } from '@/app/models/model';
import { toast } from 'sonner';

interface PlatoDraft {
  nombre: string;
  precio: string;
  tipoPlato: TipoPlatoRestaurante;
}

const INITIAL_DRAFT: PlatoDraft = {
  nombre: '',
  precio: '',
  tipoPlato: 'COMIDA',
};

/**
 * @description Página de carta de restaurante con alta y listado de platos.
 * @param {Record<string, never>} _props - Sin props para esta página.
 * @returns {JSX.Element} Vista de carta para operación.
 */
export default function RestauranteCartaPage(_props: Record<string, never>): JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const [draft, setDraft] = useState<PlatoDraft>(INITIAL_DRAFT);
  const [tipoFilter, setTipoFilter] = useState<TipoPlatoRestaurante | 'TODOS'>('TODOS');

  const { data: platos, isLoading } = useGetPlatosRestauranteQuery();
  const [createPlato, { isLoading: isCreating }] = useCreatePlatoRestauranteMutation();

  const filteredPlatos = useMemo(() => {
    if (!platos) {
      return [];
    }

    if (tipoFilter === 'TODOS') {
      return platos;
    }

    return platos.filter((plato) => plato.tipoPlato === tipoFilter);
  }, [platos, tipoFilter]);

  /**
   * @description Crea un plato nuevo en carta.
   * @returns {Promise<void>} Promesa del flujo de creación.
   */
  const handleCreatePlato = async (): Promise<void> => {
    const precio = Number(draft.precio);

    if (!draft.nombre.trim()) {
      toast.error('El nombre del plato es obligatorio.');
      return;
    }

    if (!Number.isInteger(precio) || precio < 0) {
      toast.error('El precio debe ser un número válido.');
      return;
    }

    try {
      await createPlato({
        nombre: draft.nombre.trim(),
        precio,
        tipoPlato: draft.tipoPlato,
      }).unwrap();

      toast.success('Plato creado en carta.');
      setDraft(INITIAL_DRAFT);
    } catch (error) {
      console.error('Error al crear plato:', error);
      toast.error('No se pudo crear el plato.');
    }
  };

  return (
    <div className='space-y-4 px-3 py-4 sm:px-4 md:px-6'>
      <motion.header
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: 'easeOut' as const }}
      >
        <h1 className='text-2xl font-semibold'>Carta y Menú</h1>
        <p className='text-sm text-muted-foreground'>
          Gestión rápida de platos para publicar en POS.
        </p>
      </motion.header>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Nuevo plato</CardTitle>
            <CardDescription>Alta rápida para operación diaria.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='space-y-1'>
              <Label htmlFor='plato-nombre'>Nombre</Label>
              <Input
                id='plato-nombre'
                value={draft.nombre}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, nombre: event.target.value }))
                }
                placeholder='Ej: Pizza especial'
              />
            </div>

            <div className='space-y-1'>
              <Label htmlFor='plato-precio'>Precio</Label>
              <Input
                id='plato-precio'
                type='number'
                min={0}
                value={draft.precio}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, precio: event.target.value }))
                }
                placeholder='0'
              />
            </div>

            <div className='space-y-1'>
              <Label>Tipo</Label>
              <Select
                value={draft.tipoPlato}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    tipoPlato: value as TipoPlatoRestaurante,
                  }))
                }
              >
                <SelectTrigger className='h-11'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='COMIDA'>Comida</SelectItem>
                  <SelectItem value='BEBIDA'>Bebida</SelectItem>
                  <SelectItem value='POSTRE'>Postre</SelectItem>
                  <SelectItem value='APERITIVO'>Aperitivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className='h-11 w-full cursor-pointer'
              onClick={() => void handleCreatePlato()}
              disabled={isCreating}
            >
              <Plus className='mr-2 h-4 w-4' />
              Guardar plato
            </Button>
          </CardContent>
        </Card>

        <Card className='lg:col-span-2'>
          <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle className='text-base'>Platos en carta</CardTitle>
              <CardDescription>Total: {filteredPlatos.length}</CardDescription>
            </div>
            <Select
              value={tipoFilter}
              onValueChange={(value) =>
                setTipoFilter(value as TipoPlatoRestaurante | 'TODOS')
              }
            >
              <SelectTrigger className='h-11 w-[180px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='TODOS'>Todos</SelectItem>
                <SelectItem value='COMIDA'>Comida</SelectItem>
                <SelectItem value='BEBIDA'>Bebida</SelectItem>
                <SelectItem value='POSTRE'>Postre</SelectItem>
                <SelectItem value='APERITIVO'>Aperitivo</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className='space-y-2'>
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className='h-14 w-full rounded-lg' />
                ))}
              </div>
            ) : filteredPlatos.length === 0 ? (
              <div className='rounded-lg border border-dashed p-8 text-center'>
                <Utensils className='mx-auto h-6 w-6 text-muted-foreground' />
                <p className='mt-2 text-sm text-muted-foreground'>No hay platos registrados.</p>
              </div>
            ) : (
              <div className='space-y-2'>
                {filteredPlatos.map((plato) => (
                  <div
                    key={plato.platoId}
                    className='flex items-center justify-between rounded-lg border p-3'
                  >
                    <div>
                      <p className='text-sm font-medium'>{plato.nombre}</p>
                      <p className='text-xs text-muted-foreground'>
                        {plato.categoriaPlato?.nombre ?? 'Sin categoría'}
                      </p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Badge variant='secondary'>{plato.tipoPlato}</Badge>
                      <span className='text-sm font-semibold'>
                        ${plato.precio.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
