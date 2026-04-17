'use client';

import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { useDeleteMesaRestauranteMutation, useGetMesasRestauranteQuery, useUpdateMesaRestauranteMutation, useAddMesaRestauranteMutation } from '@/lib/redux/services/mesasRestauranteApi';
import { MesaRestauranteEstado } from '@/app/models/model';
import { toast } from 'sonner';

interface MesaDraft {
  numero: string;
  capacidad: string;
  estado: MesaRestauranteEstado;
}

const ESTADO_LABELS: Record<MesaRestauranteEstado, string> = {
  DISPONIBLE: 'Disponible',
  OCUPADA: 'Ocupada',
  RESERVADA: 'Reservada',
};

const ESTADO_BADGE_STYLES: Record<MesaRestauranteEstado, string> = {
  DISPONIBLE: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
  OCUPADA: 'border-rose-500/40 bg-rose-500/10 text-rose-700',
  RESERVADA: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
};

const INITIAL_MESA_DRAFT: MesaDraft = {
  numero: '',
  capacidad: '4',
  estado: 'DISPONIBLE',
};

/**
 * @description Construye clases de estilo para estado de mesa.
 * @param {MesaRestauranteEstado} estado - Estado actual de mesa.
 * @returns {string} Clases Tailwind para representar el estado.
 */
function getEstadoClassName(estado: MesaRestauranteEstado): string {
  return ESTADO_BADGE_STYLES[estado];
}

/**
 * @description Panel de gestión de mesas para restaurante optimizado para móvil/tablet.
 * @param {Record<string, never>} _props - Sin props por el momento.
 * @returns {JSX.Element} Vista interactiva de creación, edición y estado de mesas.
 */
export function MesasBoard(_props: Record<string, never>): JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const [estadoFilter, setEstadoFilter] = useState<MesaRestauranteEstado | 'TODAS'>('TODAS');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingMesaId, setEditingMesaId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<MesaDraft>(INITIAL_MESA_DRAFT);
  const [editDraft, setEditDraft] = useState<MesaDraft>(INITIAL_MESA_DRAFT);

  const { data: mesas, isLoading, isFetching } = useGetMesasRestauranteQuery({
    estado: estadoFilter,
  });

  const [addMesa, { isLoading: isCreating }] = useAddMesaRestauranteMutation();
  const [updateMesa, { isLoading: isUpdating }] = useUpdateMesaRestauranteMutation();
  const [deleteMesa, { isLoading: isDeleting }] = useDeleteMesaRestauranteMutation();

  const metrics = useMemo(() => {
    const list = mesas ?? [];

    return {
      total: list.length,
      disponibles: list.filter((mesa) => mesa.estado === 'DISPONIBLE').length,
      ocupadas: list.filter((mesa) => mesa.estado === 'OCUPADA').length,
      reservadas: list.filter((mesa) => mesa.estado === 'RESERVADA').length,
    };
  }, [mesas]);

  /**
   * @description Crea una mesa nueva en base a los valores del formulario.
   * @returns {Promise<void>} Promesa de ejecución del flujo de creación.
   */
  const handleCreateMesa = async (): Promise<void> => {
    const numero = Number(createDraft.numero);
    const capacidad = Number(createDraft.capacidad);

    if (!Number.isInteger(numero) || numero < 1) {
      toast.error('Número de mesa inválido.');
      return;
    }

    if (!Number.isInteger(capacidad) || capacidad < 1) {
      toast.error('Capacidad inválida.');
      return;
    }

    try {
      await addMesa({
        numero,
        capacidad,
        estado: createDraft.estado,
      }).unwrap();

      toast.success('Mesa creada correctamente.');
      setCreateDialogOpen(false);
      setCreateDraft(INITIAL_MESA_DRAFT);
    } catch (error) {
      console.error('Error al crear mesa:', error);
      toast.error('No se pudo crear la mesa.');
    }
  };

  /**
   * @description Inicializa el formulario de edición con los datos de una mesa.
   * @param {string} mesaId - Identificador único de la mesa.
   * @returns {void} Sin retorno.
   */
  const openEditDialog = (mesaId: string): void => {
    const mesa = mesas?.find((item) => item.mesaId === mesaId);
    if (!mesa) {
      return;
    }

    setEditDraft({
      numero: String(mesa.numero),
      capacidad: String(mesa.capacidad),
      estado: mesa.estado,
    });
    setEditingMesaId(mesaId);
  };

  /**
   * @description Persiste cambios de edición de una mesa.
   * @returns {Promise<void>} Promesa de ejecución del flujo de actualización.
   */
  const handleSaveEdit = async (): Promise<void> => {
    if (!editingMesaId) {
      return;
    }

    const numero = Number(editDraft.numero);
    const capacidad = Number(editDraft.capacidad);

    if (!Number.isInteger(numero) || numero < 1) {
      toast.error('Número de mesa inválido.');
      return;
    }

    if (!Number.isInteger(capacidad) || capacidad < 1) {
      toast.error('Capacidad inválida.');
      return;
    }

    try {
      await updateMesa({
        mesaId: editingMesaId,
        numero,
        capacidad,
        estado: editDraft.estado,
      }).unwrap();

      toast.success('Mesa actualizada.');
      setEditingMesaId(null);
    } catch (error) {
      console.error('Error al actualizar mesa:', error);
      toast.error('No se pudo actualizar la mesa.');
    }
  };

  /**
   * @description Elimina una mesa del listado.
   * @param {string} mesaId - Identificador de la mesa a eliminar.
   * @returns {Promise<void>} Promesa de ejecución del flujo de borrado.
   */
  const handleDeleteMesa = async (mesaId: string): Promise<void> => {
    try {
      await deleteMesa(mesaId).unwrap();
      toast.success('Mesa eliminada correctamente.');
    } catch (error) {
      console.error('Error al eliminar mesa:', error);
      toast.error('No se pudo eliminar la mesa.');
    }
  };

  const baseTransition = {
    duration: shouldReduceMotion ? 0 : 0.24,
    ease: 'easeOut' as const,
  };

  return (
    <section className='space-y-4 px-2 py-4 sm:px-4 md:px-6'>
      <motion.div
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={baseTransition}
        className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
      >
        <div className='flex items-center gap-3'>
          <div className='rounded-xl bg-primary/10 p-2 text-primary'>
            <UtensilsCrossed className='h-5 w-5' />
          </div>
          <div>
            <h1 className='text-xl font-semibold'>Gestión de Mesas</h1>
            <p className='text-sm text-muted-foreground'>
              Control de ocupación en tiempo real para operaciones de salón.
            </p>
          </div>
        </div>

        <div className='flex flex-col gap-2 sm:flex-row'>
          <Select
            value={estadoFilter}
            onValueChange={(value) =>
              setEstadoFilter(value as MesaRestauranteEstado | 'TODAS')
            }
          >
            <SelectTrigger className='h-11 min-w-45'>
              <SelectValue placeholder='Filtrar por estado' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='TODAS'>Todas</SelectItem>
              <SelectItem value='DISPONIBLE'>Disponibles</SelectItem>
              <SelectItem value='OCUPADA'>Ocupadas</SelectItem>
              <SelectItem value='RESERVADA'>Reservadas</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className='h-11 min-w-45 cursor-pointer'>
                <Plus className='mr-2 h-4 w-4' />
                Nueva mesa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear mesa</DialogTitle>
                <DialogDescription>
                  Registra una mesa disponible para usarla en POS.
                </DialogDescription>
              </DialogHeader>

              <div className='grid gap-4'>
                <div className='grid gap-2'>
                  <Label htmlFor='mesa-numero'>Número</Label>
                  <Input
                    id='mesa-numero'
                    type='number'
                    min={1}
                    value={createDraft.numero}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({
                        ...prev,
                        numero: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='mesa-capacidad'>Capacidad</Label>
                  <Input
                    id='mesa-capacidad'
                    type='number'
                    min={1}
                    value={createDraft.capacidad}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({
                        ...prev,
                        capacidad: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className='grid gap-2'>
                  <Label>Estado inicial</Label>
                  <Select
                    value={createDraft.estado}
                    onValueChange={(value) =>
                      setCreateDraft((prev) => ({
                        ...prev,
                        estado: value as MesaRestauranteEstado,
                      }))
                    }
                  >
                    <SelectTrigger className='h-11'>
                      <SelectValue placeholder='Seleccione estado' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='DISPONIBLE'>Disponible</SelectItem>
                      <SelectItem value='OCUPADA'>Ocupada</SelectItem>
                      <SelectItem value='RESERVADA'>Reservada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  className='cursor-pointer'
                  onClick={handleCreateMesa}
                  disabled={isCreating}
                >
                  Crear mesa
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <motion.div
        className='grid grid-cols-2 gap-2 sm:grid-cols-4'
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...baseTransition, delay: shouldReduceMotion ? 0 : 0.05 }}
      >
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Total</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-semibold'>{metrics.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Disponibles</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-semibold text-emerald-700'>
            {metrics.disponibles}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Ocupadas</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-semibold text-rose-700'>
            {metrics.ocupadas}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Reservadas</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-semibold text-amber-700'>
            {metrics.reservadas}
          </CardContent>
        </Card>
      </motion.div>

      {isLoading || isFetching ? (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className='h-40 w-full rounded-xl' />
          ))}
        </div>
      ) : (
        <AnimatePresence>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {mesas?.map((mesa, index) => (
              <motion.article
                key={mesa.mesaId}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -10 }}
                transition={{
                  ...baseTransition,
                  delay: shouldReduceMotion ? 0 : index * 0.03,
                }}
                className='rounded-xl border border-border bg-card p-4 shadow-sm'
              >
                <div className='flex items-start justify-between'>
                  <div>
                    <p className='text-sm text-muted-foreground'>Mesa</p>
                    <h3 className='text-2xl font-semibold leading-tight'>#{mesa.numero}</h3>
                  </div>

                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getEstadoClassName(
                      mesa.estado
                    )}`}
                  >
                    {ESTADO_LABELS[mesa.estado]}
                  </span>
                </div>

                <div className='mt-4 flex items-center justify-between'>
                  <p className='text-sm text-muted-foreground'>Capacidad: {mesa.capacidad}</p>

                  <Select
                    value={mesa.estado}
                    onValueChange={async (value) => {
                      try {
                        await updateMesa({
                          mesaId: mesa.mesaId,
                          estado: value as MesaRestauranteEstado,
                        }).unwrap();
                        toast.success('Estado actualizado.');
                      } catch (error) {
                        console.error('Error al actualizar estado:', error);
                        toast.error('No se pudo actualizar el estado.');
                      }
                    }}
                  >
                    <SelectTrigger className='h-10 w-[140px]'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='DISPONIBLE'>Disponible</SelectItem>
                      <SelectItem value='OCUPADA'>Ocupada</SelectItem>
                      <SelectItem value='RESERVADA'>Reservada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className='mt-4 grid grid-cols-2 gap-2'>
                  <Button
                    variant='outline'
                    className='h-11 cursor-pointer'
                    onClick={() => openEditDialog(mesa.mesaId)}
                  >
                    <Pencil className='mr-2 h-4 w-4' />
                    Editar
                  </Button>
                  <Button
                    variant='outline'
                    className='h-11 cursor-pointer border-destructive/40 text-destructive'
                    onClick={() => void handleDeleteMesa(mesa.mesaId)}
                    disabled={isDeleting}
                  >
                    <Trash2 className='mr-2 h-4 w-4' />
                    Eliminar
                  </Button>
                </div>
              </motion.article>
            ))}
          </div>
        </AnimatePresence>
      )}

      <Dialog open={Boolean(editingMesaId)} onOpenChange={() => setEditingMesaId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar mesa</DialogTitle>
            <DialogDescription>Actualiza número, capacidad y estado.</DialogDescription>
          </DialogHeader>

          <div className='grid gap-4'>
            <div className='grid gap-2'>
              <Label htmlFor='editar-numero'>Número</Label>
              <Input
                id='editar-numero'
                type='number'
                min={1}
                value={editDraft.numero}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, numero: event.target.value }))
                }
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='editar-capacidad'>Capacidad</Label>
              <Input
                id='editar-capacidad'
                type='number'
                min={1}
                value={editDraft.capacidad}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, capacidad: event.target.value }))
                }
              />
            </div>

            <div className='grid gap-2'>
              <Label>Estado</Label>
              <Select
                value={editDraft.estado}
                onValueChange={(value) =>
                  setEditDraft((prev) => ({
                    ...prev,
                    estado: value as MesaRestauranteEstado,
                  }))
                }
              >
                <SelectTrigger className='h-11'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='DISPONIBLE'>Disponible</SelectItem>
                  <SelectItem value='OCUPADA'>Ocupada</SelectItem>
                  <SelectItem value='RESERVADA'>Reservada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => void handleSaveEdit()} disabled={isUpdating}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
