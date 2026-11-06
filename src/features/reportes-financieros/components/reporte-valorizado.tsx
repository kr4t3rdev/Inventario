'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getValorizadoAFechaAction } from '@/features/reportes-financieros/actions-valorizado';
import { exportToCsv } from '@/lib/export-utils';
import { formatCurrency } from '@/lib/utils';
import { ReportErrorState } from './report-error-state';
import { ReportKpiCard } from './report-kpi-card';

type DatosValorizado = Extract<Awaited<ReturnType<typeof getValorizadoAFechaAction>>, { success: true }>['data'];

const FECHA_INICIAL = format(new Date(), 'yyyy-MM-dd');

/**
 * @description Vista del valorizado oficial de inventario a una fecha de corte.
 * @returns {JSX.Element} Tabla de existencias valorizadas con exportación CSV.
 */
export function ReporteValorizado() {
  const [fechaCorte, setFechaCorte] = useState(FECHA_INICIAL);
  const [datos, setDatos] = useState<DatosValorizado | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    let vigente = true;
    const [anio, mes, dia] = fechaCorte.split('-').map(Number);
    setIsLoading(true);
    void getValorizadoAFechaAction({ fechaCorte: new Date(anio, mes - 1, dia) }).then((respuesta) => {
      if (!vigente) return;
      if (respuesta.success) {
        setDatos(respuesta.data);
        setError(null);
      } else {
        setDatos(null);
        setError(respuesta.error?.message ?? 'No se pudo generar el valorizado');
      }
      setIsLoading(false);
    });
    return () => { vigente = false; };
  }, [fechaCorte, reintento]);

  const filas = (datos?.porProducto ?? []).filter((fila) => fila.unidadesFifo + fila.unidadesEstimadas > 0);

  const exportarCsv = () => {
    exportToCsv(
      filas.map((fila) => ({
        'Fecha de corte': fechaCorte,
        Producto: fila.productoNombre,
        Cantidad: fila.unidadesFifo + fila.unidadesEstimadas,
        'Costo unitario': fila.costoUnitarioFifo,
        'Total valorizado': fila.valorFifo,
      })),
      `Valorizado_Inventario_${fechaCorte}`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Input type="date" aria-label="Fecha de corte" value={fechaCorte} onChange={(evento) => setFechaCorte(evento.target.value)} className="w-[180px]" />
        <Button variant="outline" size="sm" onClick={exportarCsv} disabled={isLoading || filas.length === 0}>
          <FileText className="mr-2 h-4 w-4" />
          CSV
        </Button>
      </div>

      {error ? (
        <ReportErrorState title="No se pudo generar el valorizado" description={error} onRetry={() => setReintento((valor) => valor + 1)} />
      ) : null}

      {isLoading ? <Skeleton className="h-40 w-full" aria-label="Cargando valorizado" /> : null}

      {!isLoading && !error && filas.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No hay existencias valorizadas al cierre de la fecha seleccionada.</p>
      ) : null}

      {!isLoading && !error && filas.length > 0 ? (
        <>
          <ReportKpiCard label="Total valorizado" value={formatCurrency(datos?.valorTotalFifo ?? 0)} sublabel={`Fecha de corte: ${fechaCorte}`} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo unitario</TableHead>
                <TableHead className="text-right">Total valorizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => (
                <TableRow key={fila.productoId}>
                  <TableCell className="font-medium">{fila.productoNombre}</TableCell>
                  <TableCell className="text-right">{fila.unidadesFifo + fila.unidadesEstimadas}</TableCell>
                  <TableCell className="text-right">{formatCurrency(fila.costoUnitarioFifo)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(fila.valorFifo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : null}
    </div>
  );
}
