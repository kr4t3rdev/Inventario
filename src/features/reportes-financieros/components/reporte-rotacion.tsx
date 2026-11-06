'use client';

import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { FileDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getRotacionInventarioAction } from '@/features/reportes-financieros/actions-rotacion';
import { exportToCsv } from '@/lib/export-utils';
import { ReportErrorState } from './report-error-state';

type Resultado = Extract<Awaited<ReturnType<typeof getRotacionInventarioAction>>, { success: true }>['data'];
const HOY = new Date();

/**
 * @description Vista de rotación por producto con periodo filtrable y exportación CSV.
 * @returns {JSX.Element} Reporte tabular de rotación de inventario.
 */
export function ReporteRotacion() {
  const [desde, setDesde] = useState(format(subDays(HOY, 29), 'yyyy-MM-dd'));
  const [hasta, setHasta] = useState(format(HOY, 'yyyy-MM-dd'));
  const [datos, setDatos] = useState<Resultado | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = async (evento?: React.FormEvent<HTMLFormElement>) => {
    evento?.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const respuesta = await getRotacionInventarioAction({
        fechaDesde: new Date(`${desde}T00:00:00.000Z`),
        fechaHasta: new Date(`${hasta}T00:00:00.000Z`),
      });
      if (respuesta.success) setDatos(respuesta.data);
      else { setDatos(null); setError(respuesta.error?.message ?? 'No se pudo consultar la rotación'); }
    } catch {
      setDatos(null);
      setError('No se pudo consultar la rotación');
    } finally {
      setIsLoading(false);
    }
  };

  const cambiarPeriodo = (tipo: 'desde' | 'hasta', valor: string) => {
    if (tipo === 'desde') setDesde(valor);
    else setHasta(valor);
    setDatos(null);
    setError(null);
  };

  const exportar = () => {
    if (!datos) return;
    exportToCsv(datos.porProducto.map((fila) => ({
      'Fecha desde': desde, 'Fecha hasta': hasta, Producto: fila.productoNombre,
      'Unidades salidas': fila.unidadesSalidas, 'Existencias promedio': fila.existenciasPromedio,
      Rotación: fila.rotacion ?? 'Sin existencias',
    })), `Rotacion_Inventario_${desde}_${hasta}`);
  };

  return (
    <div className='space-y-4'>
      <form className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between' onSubmit={consultar}>
        <div className='flex flex-wrap gap-3'>
          <div className='space-y-1'><Label htmlFor='rotacion-desde'>Desde</Label><Input id='rotacion-desde' type='date' required value={desde} onChange={(e) => cambiarPeriodo('desde', e.target.value)} /></div>
          <div className='space-y-1'><Label htmlFor='rotacion-hasta'>Hasta</Label><Input id='rotacion-hasta' type='date' required value={hasta} onChange={(e) => cambiarPeriodo('hasta', e.target.value)} /></div>
          <Button type='submit' variant='outline' disabled={isLoading}>Consultar</Button>
        </div>
        <Button type='button' variant='outline' onClick={exportar} disabled={isLoading || !datos?.porProducto.length}>
          <FileDown className='mr-2 h-4 w-4' /> CSV
        </Button>
      </form>
      {error ? <ReportErrorState title='No se pudo consultar la rotación' description={error} onRetry={() => void consultar()} /> : null}
      {isLoading ? <Skeleton className='h-40 w-full' aria-label='Cargando rotación' /> : null}
      {!isLoading && datos && datos.porProducto.length === 0 ? <p className='rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground'>No hay productos con rotación en el periodo seleccionado.</p> : null}
      {!isLoading && datos && datos.porProducto.length > 0 ? (
        <div className='overflow-x-auto rounded-lg border'>
          <Table>
            <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className='text-right'>Unidades salidas</TableHead><TableHead className='text-right'>Existencias promedio</TableHead><TableHead className='text-right'>Rotación</TableHead></TableRow></TableHeader>
            <TableBody>{datos.porProducto.map((fila) => <TableRow key={fila.productoId}><TableCell>{fila.productoNombre}</TableCell><TableCell className='text-right'>{fila.unidadesSalidas}</TableCell><TableCell className='text-right'>{fila.existenciasPromedio}</TableCell><TableCell className='text-right'>{fila.rotacion === null ? 'Sin existencias' : `${fila.rotacion}×`}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
