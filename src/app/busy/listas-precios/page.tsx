'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useAddListaPrecioMutation,
  useDeleteListaPrecioMutation,
  useGetListasPreciosQuery,
} from '@/lib/redux/services/listasPreciosApi';

/**
 * @description Página de administración de listas de precios.
 * @returns {JSX.Element} Vista para crear y eliminar listas.
 */
export default function ListasPreciosPage(): React.JSX.Element {
  const { data: listas, isLoading } = useGetListasPreciosQuery();
  const [addListaPrecio] = useAddListaPrecioMutation();
  const [deleteListaPrecio] = useDeleteListaPrecioMutation();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const onCreate = async () => {
    if (!nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    try {
      await addListaPrecio({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
      }).unwrap();
      setNombre('');
      setDescripcion('');
      toast.success('Lista de precios creada');
    } catch (error) {
      console.error('Error creando lista de precios', error);
      toast.error('No se pudo crear la lista');
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteListaPrecio(id).unwrap();
      toast.success('Lista eliminada');
    } catch (error) {
      console.error('Error eliminando lista de precios', error);
      toast.error('No se pudo eliminar la lista');
    }
  };

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className='container mx-auto space-y-6 py-4'>
          <Card className='border-dashed'>
            <CardHeader>
              <CardTitle>Listas de precios</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4 md:grid-cols-3'>
              <div className='md:col-span-1 space-y-2'>
                <Label htmlFor='nombre-lista'>Nombre</Label>
                <Input
                  id='nombre-lista'
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder='Ej: Sucursal Centro'
                />
              </div>
              <div className='md:col-span-1 space-y-2'>
                <Label htmlFor='desc-lista'>Descripción</Label>
                <Input
                  id='desc-lista'
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  placeholder='Opcional'
                />
              </div>
              <div className='md:col-span-1 flex items-end'>
                <Button className='w-full gap-2' onClick={onCreate}>
                  <Plus className='h-4 w-4' />
                  Crear lista
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className='border-dashed'>
            <CardHeader>
              <CardTitle>Listas registradas</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {isLoading ? (
                <p className='text-sm text-muted-foreground'>Cargando listas...</p>
              ) : listas && listas.length > 0 ? (
                listas.map((lista) => (
                  <div
                    key={lista.id}
                    className='flex items-center justify-between rounded-md border p-3'
                  >
                    <div>
                      <p className='font-medium'>{lista.nombre}</p>
                      <p className='text-xs text-muted-foreground'>
                        {lista.descripcion || 'Sin descripción'}
                      </p>
                    </div>
                    <Button
                      variant='outline'
                      size='icon'
                      onClick={() => onDelete(lista.id)}
                      aria-label={`Eliminar ${lista.nombre}`}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                ))
              ) : (
                <p className='text-sm text-muted-foreground'>No hay listas creadas.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
