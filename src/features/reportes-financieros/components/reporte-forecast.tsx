'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { FileDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getForecastQuiebreAction } from '@/features/reportes-financieros/actions-forecast';
import { exportToCsv } from '@/lib/export-utils';
import { ReportErrorState } from './report-error-state';

type Resultado = Extract<Awaited<ReturnType<typeof getForecastQuiebreAction>>, { success: true }>['data'];

/**
 * @description Presenta el forecast por producto con ventana ajustable y CSV.
 * @returns {JSX.Element} Tabla de disponibilidad y estimación de quiebre.
 */
export function ReporteForecast() {
  const [fechaCorte, setFechaCorte] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [ventanaDias, setVentanaDias] = useState(90);
  const [datos, setDatos] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = async (evento?: React.FormEvent<HTMLFormElement>) => {
    evento?.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const respuesta = await getForecastQuiebreAction({ fechaCorte: new Date(`${fechaCorte}T00:00:00Z`), ventanaDias });
      if (respuesta.success) setDatos(respuesta.data);
      else { setDatos(null); setError(respuesta.error?.message ?? 'No se pudo consultar el forecast'); }
    } catch {
      setDatos(null);
      setError('No se pudo consultar el forecast');
    } finally {
      setCargando(false);
    }
  };

  const exportar = () => {
    if (!datos) return;
    exportToCsv(datos.porProducto.map((fila) => ({
      'Fecha de corte': fechaCorte, 'Ventana (días)': ventanaDias, Producto: fila.productoNombre,
      Disponibilidad: fila.disponibilidad, 'Consumo en ventana': fila.consumoTotal,
      'Tasa diaria': fila.tasaDiaria, 'Días hasta quiebre': fila.diasHastaQuiebre ?? 'Sin estimación confiable',
      'Fecha estimada': fila.fechaQuiebre ?? 'Sin estimación confiable',
      Confianza: fila.estado === 'estimado' ? 'Estimación disponible' : fila.estado === 'sin_demanda' ? 'Sin demanda' : 'Datos insuficientes',
    })), `Forecast_Quiebre_${fechaCorte}_${ventanaDias}d`);
  };

  return (
    <div className='space-y-4'>
      <form className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between' onSubmit={consultar}>
        <div className='flex flex-wrap items-end gap-3'>
          <div className='space-y-1'><Label htmlFor='forecast-corte'>Fecha de corte</Label><Input id='forecast-corte' type='date' required value={fechaCorte} onChange={(e) => { setFechaCorte(e.target.value); setDatos(null); }} /></div>
          <div className='space-y-1'><Label htmlFor='forecast-ventana'>Ventana (días)</Label><Input id='forecast-ventana' type='number' min={7} max={180} required value={ventanaDias} onChange={(e) => { setVentanaDias(Number(e.target.value)); setDatos(null); }} /></div>
          <Button type='submit' variant='outline' disabled={cargando || ventanaDias < 7 || ventanaDias > 180}>Consultar</Button>
        </div>
        <Button type='button' variant='outline' onClick={exportar} disabled={cargando || !datos?.porProducto.length}><FileDown className='mr-2 h-4 w-4' /> CSV</Button>
      </form>
      {datos ? <p className='text-sm text-muted-foreground'>{datos.supuestos} Ventana: {datos.ventana.dias} días, del {new Date(datos.ventana.inicio).toLocaleDateString('es', { timeZone: 'UTC' })} al {new Date(datos.fechaCorte).toLocaleDateString('es', { timeZone: 'UTC' })}.</p> : null}
      {error ? <ReportErrorState title='No se pudo consultar el forecast' description={error} onRetry={() => void consultar()} /> : null}
      {cargando ? <Skeleton className='h-40 w-full' aria-label='Cargando forecast' /> : null}
      {!cargando && datos?.porProducto.length === 0 ? <p className='rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground'>No hay productos para estimar con el stock y las ventas registradas.</p> : null}
      {!cargando && datos?.porProducto.length ? <div className='overflow-x-auto rounded-lg border'>
        <Table><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className='text-right'>Disponible</TableHead><TableHead className='text-right'>Consumo</TableHead><TableHead className='text-right'>Días estimados</TableHead><TableHead>Fecha estimada</TableHead><TableHead>Confianza</TableHead></TableRow></TableHeader>
          <TableBody>{datos.porProducto.map((fila) => <TableRow key={fila.productoId}><TableCell>{fila.productoNombre}</TableCell><TableCell className='text-right'>{fila.disponibilidad}</TableCell><TableCell className='text-right'>{fila.consumoTotal}</TableCell><TableCell className='text-right'>{fila.diasHastaQuiebre === null ? '—' : `${fila.diasHastaQuiebre} días`}</TableCell><TableCell>{fila.fechaQuiebre ? new Date(fila.fechaQuiebre).toLocaleDateString('es', { timeZone: 'UTC' }) : '—'}</TableCell><TableCell>{fila.estado === 'estimado' ? 'Estimación disponible' : fila.estado === 'sin_demanda' ? 'Sin demanda' : 'Datos insuficientes'}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div> : null}
    </div>
  );
}
