/**
 * @description Vista cliente del historial de cuadres cerrados de turnos POS.
 */
'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Clock3, Eye, ReceiptText, Store, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import type { CuadreCerradoListItem } from '../actions-historial';

export type { CuadreCerradoListItem } from '../actions-historial';

/**
 * @description Formatea importes en CUP para el historial.
 * @param {number} value - Importe a mostrar.
 * @returns {string} Valor listo para la UI.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CU', {
    style: 'currency',
    currency: 'CUP',
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * @description Formatea la fecha principal del cuadre priorizando la fecha de cierre.
 * @param {CuadreCerradoListItem} item - Fila del historial.
 * @returns {string} Fecha resumida para la UI.
 */
function formatSettlementDate(item: CuadreCerradoListItem): string {
  return format(item.fechaCierre ?? item.fechaApertura, 'dd/MM/yyyy HH:mm');
}

/**
 * @description Obtiene la ruta del detalle reutilizando la page existente.
 * @param {string} turnoId - Identificador del turno.
 * @returns {string} Ruta del detalle.
 */
function getDetailHref(turnoId: string): string {
  return `/busy/sales/cuadre/${turnoId}?from=history`;
}

/**
 * @description Renderiza el historial de cuadres cerrados con tabla y tarjetas responsivas.
 * @param {{ items: CuadreCerradoListItem[] }} props - Props del componente.
 * @returns {JSX.Element} Historial listo para consulta.
 */
export function CuadresHistoryPageClient({
  items,
}: {
  items: CuadreCerradoListItem[];
}): JSX.Element {
  const arqueados = items.filter((item) => item.arqueado).length;

  return (
    <div className='container mx-auto space-y-6 px-4 py-6 md:px-6'>
      <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
        <div className='space-y-3'>
          <Badge variant='outline'>Consulta histórica POS</Badge>
          <div className='space-y-1'>
            <h1 className='text-3xl font-semibold tracking-tight'>Historial de cuadres cerrados</h1>
            <p className='max-w-3xl text-sm text-muted-foreground'>
              Revisa turnos cerrados, su diferencia contra arqueo y abre el cuadre existente
              por turno sin reactivar el flujo operativo.
            </p>
          </div>
          <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
            <Badge variant='secondary'>{items.length} cuadres consultables</Badge>
            <Badge variant='secondary'>{arqueados} con arqueo</Badge>
            <Badge variant='secondary'>Modo auditoría</Badge>
          </div>
        </div>

        <Button asChild variant='outline' className='gap-2 self-start'>
          <Link href='/busy/sales'>
            <ArrowLeft className='h-4 w-4' />
            Volver a ventas
          </Link>
        </Button>
      </div>

      <Card className='rounded-3xl border-slate-200/70 bg-white/85 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <ReceiptText className='h-5 w-5 text-primary' />
            Turnos cerrados guardados
          </CardTitle>
          <CardDescription>
            Cada entrada abre el detalle existente del cuadre con el contexto del turno.
          </CardDescription>
        </CardHeader>

        <CardContent className='space-y-4'>
          {items.length === 0 ? (
            <div className='flex flex-col items-center gap-4 py-12 text-center'>
              <div className='rounded-full bg-muted p-4 text-muted-foreground'>
                <Clock3 className='h-8 w-8' />
              </div>
              <div className='space-y-1'>
                <h2 className='text-lg font-semibold'>Aún no hay cuadres cerrados guardados</h2>
                <p className='text-sm text-muted-foreground'>
                  Cuando cierres un turno POS, va a aparecer acá listo para consulta.
                </p>
              </div>
              <Button asChild>
                <Link href='/busy/sales/new'>Ir al punto de venta</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className='hidden md:block'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Punto de venta</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Ventas</TableHead>
                      <TableHead>Diferencia</TableHead>
                      <TableHead className='text-right'>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.turnoId}>
                        <TableCell>
                          <div className='font-medium'>{item.puntoDeVentaNombre}</div>
                          <div className='text-xs text-muted-foreground'>#{item.turnoId.slice(-6)}</div>
                        </TableCell>
                        <TableCell>{formatSettlementDate(item)}</TableCell>
                        <TableCell>{item.empleadoNombre ?? 'Sin empleado'}</TableCell>
                        <TableCell>{formatCurrency(item.totalVentas)}</TableCell>
                        <TableCell>
                          <Badge variant={item.arqueado ? 'outline' : 'secondary'}>
                            {item.arqueado
                              ? item.diferenciaCup === null
                                ? 'Sin diferencia'
                                : formatCurrency(item.diferenciaCup)
                              : 'Sin arqueo'}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button asChild variant='outline' size='sm'>
                            <Link href={getDetailHref(item.turnoId)}>
                              <Eye className='mr-2 h-4 w-4' />
                              Ver cuadre
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className='grid gap-3 md:hidden'>
                {items.map((item) => (
                  <Card key={item.turnoId} className='border-slate-200/70 shadow-none dark:border-slate-800/70'>
                    <CardContent className='space-y-3 p-4'>
                      <div className='flex items-start justify-between gap-3'>
                        <div className='space-y-1'>
                          <div className='flex items-center gap-2 font-medium'>
                            <Store className='h-4 w-4 text-muted-foreground' />
                            <span>{item.puntoDeVentaNombre}</span>
                          </div>
                          <p className='text-xs text-muted-foreground'>#{item.turnoId.slice(-6)}</p>
                        </div>
                        <Badge variant={item.arqueado ? 'outline' : 'secondary'}>
                          {item.arqueado ? 'Arqueado' : 'Sin arqueo'}
                        </Badge>
                      </div>

                      <div className='space-y-2 text-sm'>
                        <div className='flex items-center gap-2 text-muted-foreground'>
                          <UserRound className='h-4 w-4' />
                          <span>{item.empleadoNombre ?? 'Sin empleado'}</span>
                        </div>
                        <div className='flex items-center justify-between'>
                          <span className='text-muted-foreground'>Fecha</span>
                          <span>{formatSettlementDate(item)}</span>
                        </div>
                        <div className='flex items-center justify-between'>
                          <span className='text-muted-foreground'>Ventas</span>
                          <span>{formatCurrency(item.totalVentas)}</span>
                        </div>
                        <div className='flex items-center justify-between'>
                          <span className='text-muted-foreground'>Diferencia</span>
                          <span>
                            {item.diferenciaCup === null
                              ? 'Pendiente'
                              : formatCurrency(item.diferenciaCup)}
                          </span>
                        </div>
                      </div>

                      <Button asChild className='w-full'>
                        <Link href={getDetailHref(item.turnoId)}>
                          <Eye className='mr-2 h-4 w-4' />
                          Ver cuadre
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
