'use client';

import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChefHat, Save } from 'lucide-react';
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
import { useGetProductosQuery } from '@/lib/redux/services/productosApi';
import {
  useCreateRecetaRestauranteMutation,
  useGetRecetasRestauranteQuery,
  useSetIngredientesRecetaRestauranteMutation,
} from '@/lib/redux/services/restauranteRecetasProduccionApi';
import { toast } from 'sonner';

interface RecetaDraft {
  nombre: string;
  rendimiento: string;
}

interface IngredienteDraft {
  productoId: string;
  cantidad: string;
  desperdicio: string;
}

const INITIAL_RECETA_DRAFT: RecetaDraft = {
  nombre: '',
  rendimiento: '1',
};

const INITIAL_INGREDIENTE_DRAFT: IngredienteDraft = {
  productoId: '',
  cantidad: '',
  desperdicio: '0',
};

/**
 * @description Página de gestión de recetas con edición de ingredientes y costo unitario.
 * @param {Record<string, never>} _props - Sin props para esta página.
 * @returns {JSX.Element} Vista de recetas para restaurante.
 */
export default function RestauranteRecetasPage(
  _props: Record<string, never>
): JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const [recetaDraft, setRecetaDraft] = useState<RecetaDraft>(INITIAL_RECETA_DRAFT);
  const [selectedRecetaId, setSelectedRecetaId] = useState<string>('');
  const [ingredienteDraft, setIngredienteDraft] = useState<IngredienteDraft>(
    INITIAL_INGREDIENTE_DRAFT
  );

  const { data: recetas, isLoading: loadingRecetas } = useGetRecetasRestauranteQuery();
  const { data: productos, isLoading: loadingProductos } = useGetProductosQuery();

  const [createReceta, { isLoading: creatingReceta }] =
    useCreateRecetaRestauranteMutation();
  const [setIngredientes, { isLoading: savingIngredientes }] =
    useSetIngredientesRecetaRestauranteMutation();

  const selectedReceta = useMemo(
    () => recetas?.find((receta) => receta.recetaId === selectedRecetaId) ?? null,
    [recetas, selectedRecetaId]
  );

  const availableProductos = useMemo(
    () =>
      (productos ?? []).filter(
        (producto) =>
          !selectedReceta?.ingredientes.some(
            (ingrediente) => ingrediente.productoId === producto.id
          )
      ),
    [productos, selectedReceta]
  );

  /**
   * @description Crea una receta base.
   * @returns {Promise<void>} Promesa del flujo de creación.
   */
  const handleCreateReceta = async (): Promise<void> => {
    const rendimiento = Number(recetaDraft.rendimiento);

    if (!recetaDraft.nombre.trim()) {
      toast.error('El nombre de receta es obligatorio.');
      return;
    }

    if (!Number.isInteger(rendimiento) || rendimiento < 1) {
      toast.error('Rendimiento inválido.');
      return;
    }

    try {
      const receta = await createReceta({
        nombre: recetaDraft.nombre.trim(),
        rendimiento,
      }).unwrap();

      setSelectedRecetaId(receta.recetaId);
      setRecetaDraft(INITIAL_RECETA_DRAFT);
      toast.success('Receta creada correctamente.');
    } catch (error) {
      console.error('Error al crear receta:', error);
      toast.error('No se pudo crear la receta.');
    }
  };

  /**
   * @description Agrega un ingrediente a la receta seleccionada (reemplazo completo).
   * @returns {Promise<void>} Promesa del flujo de guardado.
   */
  const handleAddIngrediente = async (): Promise<void> => {
    if (!selectedReceta) {
      toast.error('Seleccione una receta.');
      return;
    }

    const cantidad = Number(ingredienteDraft.cantidad);
    const desperdicio = Number(ingredienteDraft.desperdicio);

    if (!ingredienteDraft.productoId) {
      toast.error('Seleccione un producto.');
      return;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error('Cantidad de ingrediente inválida.');
      return;
    }

    if (!Number.isFinite(desperdicio) || desperdicio < 0 || desperdicio > 100) {
      toast.error('Desperdicio inválido.');
      return;
    }

    try {
      const ingredientes = [
        ...selectedReceta.ingredientes.map((ingrediente) => ({
          productoId: ingrediente.productoId,
          cantidad: ingrediente.cantidad,
          desperdicio: ingrediente.desperdicio,
        })),
        {
          productoId: ingredienteDraft.productoId,
          cantidad,
          desperdicio,
        },
      ];

      await setIngredientes({
        recetaId: selectedReceta.recetaId,
        ingredientes,
      }).unwrap();

      setIngredienteDraft(INITIAL_INGREDIENTE_DRAFT);
      toast.success('Ingrediente agregado y costo recalculado.');
    } catch (error) {
      console.error('Error al agregar ingrediente:', error);
      toast.error('No se pudo guardar el ingrediente.');
    }
  };

  return (
    <div className='space-y-4 px-3 py-4 sm:px-4 md:px-6'>
      <motion.header
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: 'easeOut' as const }}
      >
        <h1 className='text-2xl font-semibold'>Recetas</h1>
        <p className='text-sm text-muted-foreground'>
          Defina ingredientes y costo unitario para producción.
        </p>
      </motion.header>

      <div className='grid grid-cols-1 gap-4 xl:grid-cols-12'>
        <Card className='xl:col-span-4'>
          <CardHeader>
            <CardTitle className='text-base'>Nueva receta</CardTitle>
            <CardDescription>Registre la receta base.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='space-y-1'>
              <Label htmlFor='receta-nombre'>Nombre</Label>
              <Input
                id='receta-nombre'
                value={recetaDraft.nombre}
                onChange={(event) =>
                  setRecetaDraft((prev) => ({ ...prev, nombre: event.target.value }))
                }
                placeholder='Ej: Salsa base'
              />
            </div>

            <div className='space-y-1'>
              <Label htmlFor='receta-rendimiento'>Rendimiento</Label>
              <Input
                id='receta-rendimiento'
                type='number'
                min={1}
                value={recetaDraft.rendimiento}
                onChange={(event) =>
                  setRecetaDraft((prev) => ({ ...prev, rendimiento: event.target.value }))
                }
              />
            </div>

            <Button
              className='h-11 w-full cursor-pointer'
              onClick={() => void handleCreateReceta()}
              disabled={creatingReceta}
            >
              <ChefHat className='mr-2 h-4 w-4' />
              Crear receta
            </Button>
          </CardContent>
        </Card>

        <Card className='xl:col-span-4'>
          <CardHeader>
            <CardTitle className='text-base'>Seleccionar receta</CardTitle>
            <CardDescription>Editar ingredientes de receta existente.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {loadingRecetas ? (
              <Skeleton className='h-11 w-full rounded-md' />
            ) : (
              <Select value={selectedRecetaId} onValueChange={setSelectedRecetaId}>
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

            {selectedReceta ? (
              <div className='rounded-lg border p-3'>
                <p className='text-sm font-medium'>{selectedReceta.nombre}</p>
                <p className='text-xs text-muted-foreground'>
                  Rendimiento: {selectedReceta.rendimiento}
                </p>
                <p className='text-xs text-muted-foreground'>
                  Costo unitario: ${selectedReceta.costoUnitario.toLocaleString()}
                </p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Ingredientes: {selectedReceta.ingredientes.length}
                </p>
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>Sin receta seleccionada.</p>
            )}
          </CardContent>
        </Card>

        <Card className='xl:col-span-4'>
          <CardHeader>
            <CardTitle className='text-base'>Agregar ingrediente</CardTitle>
            <CardDescription>Actualiza receta y recalcula costo automáticamente.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='space-y-1'>
              <Label>Producto</Label>
              {loadingProductos ? (
                <Skeleton className='h-11 w-full rounded-md' />
              ) : (
                <Select
                  value={ingredienteDraft.productoId}
                  onValueChange={(value) =>
                    setIngredienteDraft((prev) => ({ ...prev, productoId: value }))
                  }
                >
                  <SelectTrigger className='h-11'>
                    <SelectValue placeholder='Seleccione producto' />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProductos.map((producto) => (
                      <SelectItem key={producto.id} value={producto.id}>
                        {producto.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1'>
                <Label htmlFor='ingrediente-cantidad'>Cantidad</Label>
                <Input
                  id='ingrediente-cantidad'
                  type='number'
                  min={0.001}
                  step='0.001'
                  value={ingredienteDraft.cantidad}
                  onChange={(event) =>
                    setIngredienteDraft((prev) => ({ ...prev, cantidad: event.target.value }))
                  }
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ingrediente-desperdicio'>Desperdicio %</Label>
                <Input
                  id='ingrediente-desperdicio'
                  type='number'
                  min={0}
                  max={100}
                  step='0.01'
                  value={ingredienteDraft.desperdicio}
                  onChange={(event) =>
                    setIngredienteDraft((prev) => ({ ...prev, desperdicio: event.target.value }))
                  }
                />
              </div>
            </div>

            <Button
              className='h-11 w-full cursor-pointer'
              onClick={() => void handleAddIngrediente()}
              disabled={savingIngredientes || !selectedReceta}
            >
              <Save className='mr-2 h-4 w-4' />
              Guardar ingrediente
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Ingredientes de receta seleccionada</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedReceta ? (
            <p className='text-sm text-muted-foreground'>Seleccione una receta para ver detalle.</p>
          ) : selectedReceta.ingredientes.length === 0 ? (
            <p className='text-sm text-muted-foreground'>La receta no tiene ingredientes aún.</p>
          ) : (
            <div className='space-y-2'>
              {selectedReceta.ingredientes.map((ingrediente) => (
                <div
                  key={ingrediente.recetaIngredienteId}
                  className='flex items-center justify-between rounded-lg border p-3'
                >
                  <div>
                    <p className='text-sm font-medium'>{ingrediente.producto.nombre}</p>
                    <p className='text-xs text-muted-foreground'>
                      Cantidad: {ingrediente.cantidad} | Desperdicio: {ingrediente.desperdicio}%
                    </p>
                  </div>
                  <Badge variant='secondary'>Stock: {ingrediente.producto.stock}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
