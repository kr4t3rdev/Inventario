'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, isValid } from 'date-fns';
import { CalendarIcon, Download, Filter } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getHistorialTasasAction, getMonedasAction } from '@/features/contabilidad/actions-exchange';
import type {
  ExchangeCurrencyRecord,
  ExchangeRateHistoryResult,
  ExchangeRateHistoryRow,
} from '@/features/contabilidad/services/exchange-types';
import { toast } from 'sonner';

interface FiltrosHistorial {
  monedaOrigen?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  busqueda?: string;
}

interface HistorialTasasTableProps {
  refreshKey?: number;
}

function formatCurrencyRate(value: number): string {
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function buildCsv(rows: ExchangeRateHistoryRow[]): string {
  const headers = [
    'Fecha',
    'Hora',
    'Conversión',
    'Tasa ID',
    'Proveniencia',
    'Registrado por',
    'Tasa Nueva',
    'Tasa Anterior',
    'Cambio (%)',
  ];

  const lines = rows.map((row, index) => {
    const previous = index < rows.length - 1 ? rows[index + 1].tasa : 0;
    const rate = Number(row.tasa);
    const previousRate = Number(previous);
    const change = previousRate ? ((rate - previousRate) / previousRate) * 100 : 0;
    const date = new Date(row.fechaVigencia);
    const valid = isValid(date);

    return [
      valid ? format(date, 'dd/MM/yyyy') : '-',
      valid ? format(date, 'HH:mm:ss') : '-',
      `${row.monedaOrigenId} → ${row.monedaDestino}`,
      row.tasaId,
      row.provenance ?? '-',
      row.creadoPor ?? '-',
      formatCurrencyRate(rate),
      previous ? formatCurrencyRate(previousRate) : '-',
      previous ? `${change > 0 ? '+' : ''}${change.toFixed(2)}%` : 'Inicial',
    ]
      .map((value) => (typeof value === 'string' && value.includes(',') ? `"${value}"` : value))
      .join(',');
  });

  return [headers.join(','), ...lines].join('\n');
}

/**
 * @description Muestra el historial de tasas con columnas de auditoría, proveniencia y paginación estable.
 * @param {HistorialTasasTableProps} props - Props opcionales para refrescar el historial.
 * @returns {JSX.Element} Tabla de historial de tasas con filtros y exportación.
 */
export function HistorialTasasTable({ refreshKey = 0 }: HistorialTasasTableProps) {
  const [filtros, setFiltros] = useState<FiltrosHistorial>({});
  const [paginaActual, setPaginaActual] = useState(1);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [monedas, setMonedas] = useState<ExchangeCurrencyRecord[]>([]);
  const [historial, setHistorial] = useState<ExchangeRateHistoryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadCurrencies = async (): Promise<void> => {
      const response = await getMonedasAction();
      if (active && response.success) {
        setMonedas(response.data ?? []);
      }
    };

    void loadCurrencies();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    let active = true;

    const loadHistory = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getHistorialTasasAction({
          monedaOrigen: filtros.monedaOrigen,
          fechaDesde: filtros.fechaDesde,
          fechaHasta: filtros.fechaHasta,
          busqueda: filtros.busqueda,
          pagina: paginaActual,
          limite: 20,
        });

        if (!active) {
          return;
        }

        if (response.success) {
          setHistorial(response.data ?? null);
        } else {
          setError(response.error?.message ?? 'Error al cargar el historial de tasas');
        }
      } catch (caughtError) {
        if (active) {
          setError(caughtError instanceof Error ? caughtError.message : 'Error al cargar el historial de tasas');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, [filtros, paginaActual, refreshKey]);

  const registros = useMemo(() => historial?.tasas ?? [], [historial]);
  const monedasSecundarias = useMemo(
    () => monedas.filter((currency) => !currency.esPrincipal),
    [monedas],
  );
  const totalPaginas = historial?.pagination.totalPages ?? 0;

  const handleFiltroChange = (campo: keyof FiltrosHistorial, valor: string): void => {
    setFiltros((current) => ({
      ...current,
      [campo]: valor === 'all' ? undefined : (valor || undefined),
    }));
    setPaginaActual(1);
  };

  const limpiarFiltros = (): void => {
    setFiltros({});
    setPaginaActual(1);
    setMostrarFiltros(false);
  };

  const exportarHistorial = (): void => {
    if (registros.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const csvContent = buildCsv(registros);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `historial_tasas_${format(new Date(), 'yyyy-MM-dd')}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success('Archivo CSV exportado correctamente');
  };

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <p className="mb-4 text-destructive">Error al cargar el historial de tasas</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isLoading && registros.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-sm font-medium">No hay historial de tasas disponible</p>
          <p className="text-sm text-muted-foreground">
            Las tasas nuevas aparecerán aquí con su proveniencia y usuario responsable.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">Historial de Tasas de Cambio</h3>
          <p className="text-sm text-muted-foreground">
            Registro completo de cambios en las tasas de conversión
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMostrarFiltros(!mostrarFiltros)}>
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          <Button variant="outline" size="sm" onClick={exportarHistorial} disabled={registros.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {mostrarFiltros && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros de Búsqueda</CardTitle>
            <CardDescription>Filtra el historial por moneda, fecha o usuario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <span className="mb-2 block text-sm font-medium">Moneda</span>
                <Select value={filtros.monedaOrigen ?? 'all'} onValueChange={(value) => handleFiltroChange('monedaOrigen', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las monedas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las monedas</SelectItem>
                    {monedasSecundarias.map((currency) => (
                      <SelectItem key={currency.codigo} value={currency.codigo}>
                        {currency.codigo} - {currency.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium">Fecha Desde</span>
                <Input type="date" value={filtros.fechaDesde || ''} onChange={(event) => handleFiltroChange('fechaDesde', event.target.value)} />
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium">Fecha Hasta</span>
                <Input type="date" value={filtros.fechaHasta || ''} onChange={(event) => handleFiltroChange('fechaHasta', event.target.value)} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={limpiarFiltros}>
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y Hora</TableHead>
                <TableHead>Conversión</TableHead>
                <TableHead>Tasa ID</TableHead>
                <TableHead>Proveniencia</TableHead>
                <TableHead>Registrado por</TableHead>
                <TableHead>Tasa Nueva</TableHead>
                <TableHead>Cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    Cargando historial...
                  </TableCell>
                </TableRow>
              ) : (
                registros.map((row, index) => {
                  const previousRate = index < registros.length - 1 ? registros[index + 1].tasa : 0;
                  const currentRate = Number(row.tasa);
                  const previousRateValue = Number(previousRate);
                  const change = previousRateValue ? ((currentRate - previousRateValue) / previousRateValue) * 100 : 0;
                  const date = new Date(row.fechaVigencia);
                  const validDate = isValid(date);

                  return (
                    <TableRow key={row.tasaId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{validDate ? format(date, 'dd/MM/yyyy') : '-'}</div>
                            <div className="text-sm text-muted-foreground">{validDate ? format(date, 'HH:mm:ss') : '-'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {row.monedaOrigenId} → {row.monedaDestino}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{row.tasaId}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.provenance ?? 'Sistema'}</Badge>
                      </TableCell>
                      <TableCell>{row.creadoPor ?? '-'}</TableCell>
                      <TableCell>
                        <span className="font-medium">{formatCurrencyRate(currentRate)}</span>
                      </TableCell>
                      <TableCell>
                        {previousRate ? (
                          <Badge variant={change > 0 ? 'default' : change < 0 ? 'destructive' : 'secondary'}>
                            {change > 0 ? '+' : ''}{change.toFixed(2)}%
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inicial</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {paginaActual} de {totalPaginas}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPaginaActual((current) => Math.max(1, current - 1))} disabled={paginaActual === 1}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPaginaActual((current) => Math.min(totalPaginas, current + 1))} disabled={paginaActual === totalPaginas}>
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
