'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { sileo } from '@/lib/sileo-shim';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  updateListaPrecioAction,
} from '@/features/listas-precios';

export interface ListaPrecioWorkspaceItem {
  id: string;
  nombre: string;
  descripcion: string | null;
  esDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { puntosDeVenta: number; precios: number };
}

interface ListasPreciosPageClientProps {
  listas: ListaPrecioWorkspaceItem[];
  initialError?: string;
}

type ListFilter = 'all' | 'default' | 'used';

/**
 * @description Workspace operativo para consultar y administrar listas de precios.
 * @param {ListasPreciosPageClientProps} props - Listas iniciales y posible error del servidor.
 * @returns {JSX.Element} Vista responsive de listas de precios.
 */
export function ListasPreciosPageClient({
  listas: initialListas,
  initialError,
}: ListasPreciosPageClientProps) {
  const router = useRouter();
  const [listas, setListas] = useState(initialListas);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ListaPrecioWorkspaceItem | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => setListas(initialListas), [initialListas]);

  const filteredListas = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return listas.filter((lista) => {
      const matchesQuery = !normalizedQuery
        || `${lista.nombre} ${lista.descripcion ?? ''}`.toLocaleLowerCase().includes(normalizedQuery);
      const matchesFilter = filter === 'all'
        || (filter === 'default' && lista.esDefault)
        || (filter === 'used' && lista._count.puntosDeVenta > 0);
      return matchesQuery && matchesFilter;
    });
  }, [filter, listas, query]);

  const metrics = useMemo(() => ({
    total: listas.length,
    defaults: listas.filter((lista) => lista.esDefault).length,
    prices: listas.reduce((total, lista) => total + lista._count.precios, 0),
    pointsOfSale: listas.reduce((total, lista) => total + lista._count.puntosDeVenta, 0),
  }), [listas]);

  /** Crea una lista con los valores del formulario. */
  async function handleCreate(): Promise<void> {
    if (!nombre.trim()) { sileo.error({ title: 'El nombre es obligatorio' }); return; }
    setPendingAction('create');
    try {
      const result = await createListaPrecioAction({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        esDefault: false,
      });
      if (!result.success) { sileo.error({ title: result.error.message }); return; }
      setNombre('');
      setDescripcion('');
      sileo.success({ title: 'Lista creada' });
      router.refresh();
    } catch (error) {
      console.error('Error creando lista de precios', error);
      sileo.error({ title: 'No se pudo crear la lista' });
    } finally {
      setPendingAction(null);
    }
  }

  /** Actualiza el nombre de la lista seleccionada. */
  async function handleEdit(lista: ListaPrecioWorkspaceItem): Promise<void> {
    const nextName = window.prompt('Nuevo nombre de la lista', lista.nombre)?.trim();
    if (!nextName || nextName === lista.nombre) return;
    setEditingId(lista.id);
    setPendingAction(`edit:${lista.id}`);
    try {
      const result = await updateListaPrecioAction({ id: lista.id, nombre: nextName });
      if (!result.success) { sileo.error({ title: result.error.message }); return; }
      setListas((current) => current.map((item) => (
        item.id === lista.id ? { ...item, nombre: result.data.nombre, updatedAt: result.data.updatedAt } : item
      )));
      sileo.success({ title: 'Lista actualizada' });
    } catch (error) {
      console.error('Error editando lista de precios', error);
      sileo.error({ title: 'No se pudo editar la lista' });
    } finally {
      setPendingAction(null);
      setEditingId(null);
    }
  }

  /** Marca una lista como predeterminada. */
  async function handleSetDefault(lista: ListaPrecioWorkspaceItem): Promise<void> {
    if (lista.esDefault) return;
    setPendingAction(`default:${lista.id}`);
    try {
      const result = await updateListaPrecioAction({ id: lista.id, esDefault: true });
      if (!result.success) { sileo.error({ title: result.error.message }); return; }
      setListas((current) => current.map((item) => ({ ...item, esDefault: item.id === lista.id })));
      sileo.success({ title: 'Lista predeterminada actualizada' });
    } catch (error) {
      console.error('Error marcando lista predeterminada', error);
      sileo.error({ title: 'No se pudo cambiar la lista predeterminada' });
    } finally {
      setPendingAction(null);
    }
  }

  /** Elimina una lista después de confirmar la operación. */
  async function handleDelete(lista: ListaPrecioWorkspaceItem): Promise<void> {
    setPendingAction(`delete:${lista.id}`);
    try {
      const result = await deleteListaPrecioAction(lista.id);
      if (!result.success) {
        const title = result.error.code === 'LISTA_PRECIO_IN_USE'
          ? 'La lista está asociada a un punto de venta y no puede eliminarse'
          : result.error.message;
        sileo.error({ title }); return;
      }
      setListas((current) => current.filter((item) => item.id !== lista.id));
      sileo.success({ title: 'Lista eliminada' });
    } catch (error) {
      console.error('Error eliminando lista de precios', error);
      sileo.error({ title: 'No se pudo eliminar la lista' });
    } finally {
      setPendingAction(null);
      setDeleteTarget(null);
    }
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <main className='container mx-auto space-y-6 px-4 py-6'>
          <header className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
            <div>
              <h1 className='text-2xl font-bold sm:text-3xl'>Listas de precios</h1>
              <p className='text-sm text-muted-foreground'>Administrá precios por sucursal y canal de venta.</p>
            </div>
            <Badge variant='secondary'>{metrics.total} listas</Badge>
          </header>

          {initialError && (
            <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
              <p className='font-semibold'>No pudimos cargar las listas de precios</p>
              <p>{initialError}</p>
            </div>
          )}

          <section aria-label='Métricas' className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
            {[
              ['Total', metrics.total], ['Predeterminadas', metrics.defaults],
              ['Precios asignados', metrics.prices], ['Puntos de venta', metrics.pointsOfSale],
            ].map(([label, value]) => (
              <Card key={label}><CardContent className='p-4'><p className='text-xs text-muted-foreground'>{label}</p><p className='text-2xl font-semibold'>{value}</p></CardContent></Card>
            ))}
          </section>

          <Card>
            <CardHeader><CardTitle className='text-base'>Nueva lista</CardTitle></CardHeader>
            <CardContent className='grid gap-4 md:grid-cols-[1fr_2fr_auto]'>
              <div className='space-y-2'><Label htmlFor='list-name'>Nombre</Label><Input id='list-name' value={nombre} onChange={(event) => setNombre(event.target.value)} /></div>
              <div className='space-y-2'><Label htmlFor='list-description'>Descripción</Label><Input id='list-description' value={descripcion} onChange={(event) => setDescripcion(event.target.value)} /></div>
              <Button className='self-end' onClick={handleCreate} disabled={pendingAction === 'create'}>
                {pendingAction === 'create' ? <Loader2 className='animate-spin' /> : <Plus />} Crear
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='gap-4'>
              <CardTitle className='text-base'>Listas registradas</CardTitle>
              <div className='flex flex-col gap-3 sm:flex-row'>
                <div className='relative flex-1'><Search className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' /><Input aria-label='Buscar listas' className='pl-9' placeholder='Buscar por nombre o descripción' value={query} onChange={(event) => setQuery(event.target.value)} /></div>
                <div className='flex gap-2' role='group' aria-label='Filtrar listas'>
                  {([['all', 'Todas'], ['default', 'Default'], ['used', 'En uso']] as const).map(([value, label]) => <Button key={value} size='sm' variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)}>{label}</Button>)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!initialError && listas.length === 0 ? (
                <div className='py-12 text-center text-sm text-muted-foreground'><p className='font-medium'>Todavía no hay listas de precios</p><p>Creá la primera con el formulario superior.</p></div>
              ) : filteredListas.length === 0 && !initialError ? (
                <p className='py-10 text-center text-sm text-muted-foreground'>No hay resultados para esta búsqueda.</p>
              ) : (
                <div className='overflow-x-auto'>
                  <Table>
                    <TableHeader><TableRow><TableHead>Lista</TableHead><TableHead>Estado</TableHead><TableHead>Precios</TableHead><TableHead>POS</TableHead><TableHead>Actualizada</TableHead><TableHead className='text-right'>Acciones</TableHead></TableRow></TableHeader>
                    <TableBody>{filteredListas.map((lista) => {
                      const isPending = pendingAction?.endsWith(`:${lista.id}`) ?? false;
                      return <TableRow key={lista.id} aria-busy={isPending}>
                        <TableCell><p className='font-medium'>{lista.nombre}</p><p className='max-w-56 truncate text-xs text-muted-foreground'>{lista.descripcion || 'Sin descripción'}</p></TableCell>
                        <TableCell>{lista.esDefault ? <Badge><Star className='mr-1 h-3 w-3' />Default</Badge> : <span className='text-muted-foreground'>Activa</span>}</TableCell>
                        <TableCell>{lista._count.precios}</TableCell><TableCell>{lista._count.puntosDeVenta}</TableCell>
                        <TableCell className='whitespace-nowrap'>{new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(lista.updatedAt))}</TableCell>
                        <TableCell><div className='flex justify-end gap-1'>
                          <Button size='icon' variant='ghost' aria-label={`Editar ${lista.nombre}`} disabled={isPending || editingId === lista.id} onClick={() => handleEdit(lista)}>{pendingAction === `edit:${lista.id}` ? <Loader2 className='animate-spin' /> : <Pencil />}</Button>
                          <Button size='icon' variant='ghost' aria-label={`Marcar ${lista.nombre} como predeterminada`} disabled={lista.esDefault || isPending} onClick={() => handleSetDefault(lista)}>{pendingAction === `default:${lista.id}` ? <Loader2 className='animate-spin' /> : <Check />}</Button>
                          <Button size='icon' variant='ghost' aria-label={`Eliminar ${lista.nombre}`} disabled={isPending} onClick={() => setDeleteTarget(lista)}>{pendingAction === `delete:${lista.id}` ? <Loader2 className='animate-spin' /> : <Trash2 />}</Button>
                        </div></TableCell>
                      </TableRow>;
                    })}</TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar lista de precios?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteTarget ? `Se eliminará “${deleteTarget.nombre}”. Esta acción no se puede deshacer.` : ''}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pendingAction?.startsWith('delete:')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!deleteTarget || pendingAction?.startsWith('delete:')}
                  onClick={(event) => {
                    event.preventDefault();
                    if (deleteTarget) void handleDelete(deleteTarget);
                  }}
                >
                  {pendingAction?.startsWith('delete:') && <Loader2 className='animate-spin' />}
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
