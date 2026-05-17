"use client";

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Tag, Tags, Sparkles, AlertCircle, ListChecks } from 'lucide-react';
import { sileo } from '@/lib/sileo-shim';
import { LazyMotion, m as motion, AnimatePresence } from 'framer-motion';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  createListaPrecioAction,
  deleteListaPrecioAction,
} from '@/features/listas-precios';

interface ListasPreciosPageClientProps {
  listas: any[]
}

/**
 * @description Spinner animado para estados de carga
 * @param {{ size?: number }} props - Tamaño en px
 * @returns {JSX.Element} Spinner circular animado
 */
function LoadingSpinner({ size = 32 }: { size?: number }) {
  return (
    <motion.div
      className='border-4 border-primary border-t-transparent rounded-full'
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  );
}

/**
 * @description Componente cliente para la página de listas de precios.
 * Recibe datos iniciales desde el Server Component.
 *
 * @param {ListasPreciosPageClientProps} props - Datos iniciales.
 * @returns {JSX.Element} Vista de administración de listas de precios.
 */
export function ListasPreciosPageClient({ listas: initialListas }: ListasPreciosPageClientProps) {
  const router = useRouter();
  const [listas, setListas] = useState<any[]>(initialListas);
  const [isCreating, setIsCreating] = useState(false);
  const [, startTransition] = useTransition();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [listaToDelete, setListaToDelete] = useState<string | null>(null);

  // Sync state when server re-fetches
  useEffect(() => {
    setListas(initialListas)
  }, [initialListas])

  const onCreate = async () => {
    if (!nombre.trim()) {
      sileo.error({ title: 'El nombre es obligatorio' });
      return;
    }

    setIsCreating(true);
    try {
  // @ts-expect-error
      const result = await createListaPrecioAction({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
      });
      if (result.success) {
        setNombre('');
        setDescripcion('');
        sileo.success({ title: 'Lista de precios creada' });
        router.refresh();
      } else {
        sileo.error({ title: result.error?.message || 'No se pudo crear la lista' });
      }
    } catch (error) {
      console.error('Error creando lista de precios', error);
      sileo.error({ title: 'No se pudo crear la lista' });
    } finally {
      setIsCreating(false);
    }
  };

  const onDelete = async () => {
    if (!listaToDelete) return;

    startTransition(async () => {
      const result = await deleteListaPrecioAction(listaToDelete);
      if (result.success) {
        sileo.success({ title: 'Lista eliminada' });
        router.refresh();
      } else {
        const error = result.error;
        if (error?.code === 'LISTA_PRECIO_IN_USE' && (error as any).puntoDeVenta?.pvId) {
          const pv = (error as any).puntoDeVenta;
          sileo.error({
            title: 'No se puede eliminar una lista de precios asociada a un punto de venta',
            description: `Está asociada a: ${pv.nombre}`,
            action: {
              label: 'Ir al punto de venta',
              onClick: () => router.push(`/busy/puntosDeVenta/update/${pv.pvId}`),
            },
            duration: 8000,
          });
        } else {
          sileo.error({ title: error?.message || 'No se pudo eliminar la lista' });
        }
      }
      setListaToDelete(null);
    });
  };

  return (
    <>
      <SidebarProvider>
        <SidebarInset>
          <motion.div
            className='container mx-auto py-4 space-y-6'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Header */}
            <motion.div
              className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <div className='flex items-center gap-3'>
                <motion.div
                  className='w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg relative'
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Tags className='h-5 w-5 text-white' />
                  <motion.div
                    animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                    transition={{
                      rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                      scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                    }}
                    className='absolute -top-1 -right-1'
                  >
                    <Sparkles className='h-4 w-4 text-yellow-400' />
                  </motion.div>
                </motion.div>
                <div>
                  <h1 className='text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent'>
                    Listas de precios
                  </h1>
                  <p className='text-muted-foreground text-sm'>
                    Gestioná las listas de precios por sucursal o canal
                  </p>
                </div>
              </div>

              <AnimatePresence>
                {listas && listas.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Badge variant='secondary' className='gap-1.5 px-3 py-1 text-sm'>
                      <ListChecks className='h-4 w-4' />
                      {listas.length} {listas.length === 1 ? 'lista' : 'listas'}
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Formulario de creación */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className='text-base flex items-center gap-2'>
                    <Plus className='h-4 w-4 text-primary' />
                    Nueva lista
                  </CardTitle>
                </CardHeader>
                <CardContent className='grid gap-4 md:grid-cols-3'>
                  <div className='md:col-span-1 space-y-2'>
                    <Label htmlFor='nombre-lista'>Nombre</Label>
                    <Input
                      id='nombre-lista'
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder='Ej: Sucursal Centro'
                      onKeyDown={(e) => e.key === 'Enter' && onCreate()}
                    />
                  </div>
                  <div className='md:col-span-1 space-y-2'>
                    <Label htmlFor='desc-lista'>Descripción</Label>
                    <Input
                      id='desc-lista'
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder='Opcional'
                      onKeyDown={(e) => e.key === 'Enter' && onCreate()}
                    />
                  </div>
                  <div className='md:col-span-1 flex items-end'>
                    <motion.div className='w-full' whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        className='w-full gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90'
                        onClick={onCreate}
                        disabled={isCreating}
                      >
                        {isCreating ? <LoadingSpinner size={16} /> : <Plus className='h-4 w-4' />}
                        {isCreating ? 'Creando...' : 'Crear lista'}
                      </Button>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Listado */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className='text-base flex items-center gap-2'>
                    <Tag className='h-4 w-4 text-primary' />
                    Listas registradas
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <AnimatePresence mode='popLayout'>
                    {listas && listas.length > 0 ? (
                      listas.map((lista, index) => (
                        <motion.div
                          key={lista.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20, height: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className='flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40 transition-colors group'
                        >
                          <div className='flex items-center gap-3'>
                            <motion.div
                              className='w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0'
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Tag className='h-4 w-4 text-primary' />
                            </motion.div>
                            <div>
                              <p className='font-medium text-sm'>{lista.nombre}</p>
                              <p className='text-xs text-muted-foreground'>
                                {lista.descripcion || 'Sin descripción'}
                              </p>
                            </div>
                          </div>
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                            <Button
                              variant='outline'
                              size='icon'
                              onClick={() => setListaToDelete(lista.id)}
                              aria-label={`Eliminar ${lista.nombre}`}
                              className='h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive hover:border-destructive'
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </motion.div>
                        </motion.div>
                      ))
                    ) : (
                      <motion.div
                        key='empty'
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className='flex flex-col items-center gap-3 py-10 text-muted-foreground'
                      >
                        <motion.div
                          className='w-16 h-16 bg-muted rounded-2xl flex items-center justify-center'
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          <Tags className='h-8 w-8 text-muted-foreground/50' />
                        </motion.div>
                        <p className='text-sm font-medium'>No hay listas creadas</p>
                        <p className='text-xs text-center max-w-xs'>
                          Usá el formulario de arriba para crear tu primera lista de precios
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </SidebarInset>
      </SidebarProvider>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={!!listaToDelete} onOpenChange={(open) => !open && setListaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className='flex items-center gap-2'>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <AlertCircle className='h-5 w-5 text-destructive' />
              </motion.div>
              ¿Eliminar lista?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La lista de precios será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
