'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LazyMotion, m as motion, useReducedMotion } from 'framer-motion';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  FileText,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: string;
  entidad: string;
  entidadId: string;
  accion: string;
  usuarioId: string;
  detalles: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

const ENTITY_BADGE_STYLES: Record<string, string> = {
  CUENTA_BANCARIA:
    'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/25 dark:text-blue-300 dark:border-blue-800/70',
  CIERRE_CONTABLE:
    'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/25 dark:text-violet-300 dark:border-violet-800/70',
  RECONCILIACION:
    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-800/70',
  TRANSFERENCIA:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:border-amber-800/70',
  AJUSTE_BANCARIO:
    'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/25 dark:text-orange-300 dark:border-orange-800/70',
  TASA_CAMBIO:
    'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/25 dark:text-cyan-300 dark:border-cyan-800/70',
  INYECCION_CAPITAL:
    'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/25 dark:text-indigo-300 dark:border-indigo-800/70',
  PAGO_DEUDA:
    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-800/70',
  TIPO_PAGO:
    'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/25 dark:text-pink-300 dark:border-pink-800/70',
  DEUDA_CASH:
    'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/25 dark:text-rose-300 dark:border-rose-800/70',
  PRESTAMO_CASH:
    'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900/25 dark:text-fuchsia-300 dark:border-fuchsia-800/70',
  PAGO_PRESTAMO:
    'bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-900/25 dark:text-lime-300 dark:border-lime-800/70',
  ANTICIPO:
    'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/25 dark:text-yellow-300 dark:border-yellow-800/70',
  CUENTA_POR_PAGAR:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/25 dark:text-red-300 dark:border-red-800/70',
  CUENTA_POR_COBRAR:
    'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/25 dark:text-sky-300 dark:border-sky-800/70',
  ESCENARIO_EXCHANGE:
    'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/25 dark:text-purple-300 dark:border-purple-800/70',
  REPORTE_PROGRAMADO:
    'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900/25 dark:text-stone-300 dark:border-stone-800/70',
  MONEDA:
    'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/25 dark:text-teal-300 dark:border-teal-800/70',
};

const ACTION_BADGE_STYLES: Record<string, string> = {
  CREATE:
    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-800/70',
  UPDATE:
    'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/25 dark:text-blue-300 dark:border-blue-800/70',
  DELETE:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/25 dark:text-red-300 dark:border-red-800/70',
  SYNC:
    'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/25 dark:text-indigo-300 dark:border-indigo-800/70',
  VALIDATE:
    'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/25 dark:text-teal-300 dark:border-teal-800/70',
  EXECUTE:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:border-amber-800/70',
  EXPORT:
    'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/25 dark:text-purple-300 dark:border-purple-800/70',
};

/**
 * @description Convierte claves de auditoría a un label legible.
 * @param {string} value - Valor en formato snake_case.
 * @returns {string} Texto amigable para mostrar.
 */
function formatAuditLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join(' ');
}

/**
 * @description Devuelve clases visuales por entidad.
 * @param {string} entidad - Entidad del registro de auditoría.
 * @returns {string} Clases Tailwind para el badge.
 */
function getEntityBadgeClass(entidad: string): string {
  return ENTITY_BADGE_STYLES[entidad] ?? 'bg-slate-100 text-slate-700 border-slate-200';
}

/**
 * @description Devuelve clases visuales por tipo de acción.
 * @param {string} accion - Acción realizada.
 * @returns {string} Clases Tailwind para el badge.
 */
function getActionBadgeClass(accion: string): string {
  return ACTION_BADGE_STYLES[accion] ?? 'bg-slate-100 text-slate-700 border-slate-200';
}

/**
 * @description Muestra filas skeleton mientras se cargan registros.
 * @returns {JSX.Element} Tabla skeleton.
 */
function AuditRowsSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <TableRow key={`audit-skeleton-${index}`}>
          <TableCell>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-36 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-28 rounded-full" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="ml-auto h-8 w-20" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/**
 * @description Tabla principal con filtros y visualización de logs de auditoría.
 * @returns {JSX.Element} Interfaz de consulta de auditoría.
 */
export function AuditLogsTable() {
  const shouldReduceMotion = useReducedMotion();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [entidad, setEntidad] = useState<string>('all');
  const [accion, setAccion] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [search, setSearch] = useState('');

  const fadeInUp = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.28,
        ease: 'easeOut' as const,
      },
    },
  };

  /**
   * @description Carga los logs de auditoría desde la API.
   * @returns {Promise<void>} Promesa de ejecución.
   */
  const fetchLogs = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      let url = `/api/contabilidad/logs?limit=${limit}&offset=${page * limit}`;
      if (entidad !== 'all') url += `&entidad=${entidad}`;
      if (accion !== 'all') url += `&accion=${accion}`;
      if (dateRange?.from) url += `&desde=${dateRange.from.toISOString()}`;
      if (dateRange?.to) url += `&hasta=${dateRange.to.toISOString()}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
      }

      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (fetchError) {
      console.error('Error fetching logs:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Error desconocido al cargar logs');
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [accion, entidad, dateRange, limit, page]);

  /**
   * @description Maneja el cambio de tamaño de página.
   * @param {number} newLimit - Nuevo límite de registros por página.
   */
  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(0); // Resetear a la primera página
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(0);
  }, [entidad, accion, dateRange]);

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const searchLower = search.toLowerCase();

    return logs.filter((log) => {
      const detailsString = JSON.stringify(log.detalles ?? '').toLowerCase();
      return (
        log.usuarioId.toLowerCase().includes(searchLower) ||
        log.entidadId.toLowerCase().includes(searchLower) ||
        detailsString.includes(searchLower)
      );
    });
  }, [logs, search]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canGoPrev = page > 0 && !loading;
  const canGoNext = (page + 1) * limit < total && !loading;
  const showEmpty = !loading && !error && filteredLogs.length === 0;

  // Calcular rango de registros mostrados
  const startItem = page * limit + 1;
  const endItem = Math.min((page + 1) * limit, total);

  return (
    <motion.div
      className="space-y-6 p-6"
      variants={fadeInUp}
      initial="hidden"
      animate="show"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            <FileText className="h-6 w-6 text-emerald-500" />
            Logs de Auditoría de Contabilidad
          </h2>
          <p className="text-sm text-muted-foreground">
            Registro detallado de operaciones y cambios sensibles del módulo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300"
          >
            {total} eventos totales
          </Badge>
          <Button
            onClick={() => {
              setError(null);
              fetchLogs();
            }}
            variant="outline"
            size="sm"
            disabled={loading}
            className="border-slate-200/70 bg-white/80 shadow-sm hover:bg-slate-100/80 dark:border-slate-800/60 dark:bg-slate-950/70 dark:hover:bg-slate-900"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuario, ID o detalles..."
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <Select value={entidad} onValueChange={setEntidad}>
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Entidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las entidades</SelectItem>
            <SelectItem value="CUENTA_BANCARIA">Cuentas bancarias</SelectItem>
            <SelectItem value="CIERRE_CONTABLE">Cierres contables</SelectItem>
            <SelectItem value="TRANSFERENCIA">Transferencias</SelectItem>
            <SelectItem value="AJUSTE_BANCARIO">Ajustes</SelectItem>
            <SelectItem value="RECONCILIACION">Reconciliaciones</SelectItem>
            <SelectItem value="INYECCION_CAPITAL">Inyección capital</SelectItem>
            <SelectItem value="PAGO_DEUDA">Pagos de deuda</SelectItem>
            <SelectItem value="TIPO_PAGO">Tipos de pago</SelectItem>
            <SelectItem value="TASA_CAMBIO">Tasas de cambio</SelectItem>
            <SelectItem value="MONEDA">Monedas</SelectItem>
            <SelectItem value="DEUDA_CASH">Deudas cash</SelectItem>
            <SelectItem value="PRESTAMO_CASH">Préstamos cash</SelectItem>
            <SelectItem value="PAGO_PRESTAMO">Pagos de préstamo</SelectItem>
            <SelectItem value="ANTICIPO">Anticipos</SelectItem>
            <SelectItem value="CUENTA_POR_PAGAR">Cuentas por pagar</SelectItem>
            <SelectItem value="CUENTA_POR_COBRAR">Cuentas por cobrar</SelectItem>
            <SelectItem value="ESCENARIO_EXCHANGE">Escenarios exchange</SelectItem>
            <SelectItem value="REPORTE_PROGRAMADO">Reportes programados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={accion} onValueChange={setAccion}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            <SelectItem value="CREATE">Creación</SelectItem>
            <SelectItem value="UPDATE">Actualización</SelectItem>
            <SelectItem value="DELETE">Eliminación</SelectItem>
            <SelectItem value="SYNC">Sincronización</SelectItem>
            <SelectItem value="EXECUTE">Ejecución</SelectItem>
            <SelectItem value="VALIDATE">Validación</SelectItem>
            <SelectItem value="EXPORT">Exportación</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-800/70">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 dark:bg-slate-900/40">
              <TableHead className="w-[190px]">Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead className="text-right">Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <AuditRowsSkeleton />}

            {!loading && error && (
              <TableRow>
                <TableCell colSpan={5} className="h-24">
                  <div className="flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <ShieldAlert className="h-4 w-4" />
                    Error: {error}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {showEmpty && (
              <TableRow>
                <TableCell colSpan={5} className="h-28">
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No se encontraron registros con los filtros aplicados.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              !error &&
              filteredLogs.map((log) => (
                <TableRow key={log.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-900/40">
                  <TableCell className="font-medium whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {new Date(log.createdAt).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{log.usuarioId}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getEntityBadgeClass(log.entidad)}>
                      {formatAuditLabel(log.entidad)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getActionBadgeClass(log.accion)}>
                      {formatAuditLabel(log.accion)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Ver
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Detalles de auditoría</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid gap-4 text-sm md:grid-cols-2">
                            <div className="space-y-1">
                              <p className="font-medium text-muted-foreground">ID de registro</p>
                              <p className="rounded bg-muted p-1 font-mono text-xs">{log.entidadId}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium text-muted-foreground">IP origen</p>
                              <p>{log.ip || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Datos del cambio</p>
                            <ScrollArea className="h-[300px] rounded-md border bg-slate-950 p-4">
                              <pre className="text-xs text-slate-50">
                                {JSON.stringify(log.detalles, null, 2)}
                              </pre>
                            </ScrollArea>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200/70 pt-4 text-sm text-muted-foreground dark:border-slate-800/70 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs md:text-sm">
            Mostrando {startItem} a {endItem} de {total} registros
          </span>
          <Select value={limit.toString()} onValueChange={(value) => handleLimitChange(parseInt(value))}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 50, 100].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">por página</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs md:text-sm">
            Página {Math.min(page + 1, totalPages)} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(0)}
              disabled={!canGoPrev}
              title="Primera página"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((value) => value - 1)}
              disabled={!canGoPrev}
              title="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((value) => value + 1)}
              disabled={!canGoNext}
              title="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(totalPages - 1)}
              disabled={!canGoNext}
              title="Última página"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
