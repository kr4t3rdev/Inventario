'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, ChevronsUpDown, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { searchComprasAction } from '@/features/reportes-financieros/actions-rentabilidad-compra';
import type { CompraResult } from '@/features/reportes-financieros/actions-rentabilidad-compra';

interface PurchaseSearchBarProps {
  onSelect: (compraId: string) => void;
  selectedId?: string;
  selectedLabel?: string;
}

/**
 * @description Selector de compras con búsqueda async para el reporte de rentabilidad.
 *
 * @param {PurchaseSearchBarProps} props - Props del componente.
 * @returns {JSX.Element} Input con combobox de búsqueda.
 */
export function PurchaseSearchBar({
  onSelect,
  selectedId,
  selectedLabel,
}: PurchaseSearchBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CompraResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback(async (q: string) => {
    setIsLoading(true);
    try {
      const r = await searchComprasAction({ search: q || undefined, limit: 10 });
      if (r.success) setResults(r.data?.compras ?? []);
    } catch {
      // Silencioso
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cargar resultados iniciales al abrir
  useEffect(() => {
    if (open && results.length === 0) {
      doSearch('');
    }
  }, [open, results.length, doSearch]);

  // Debounce de búsqueda
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between md:w-[500px]"
        >
          {selectedId && selectedLabel ? (
            <span className="truncate">{selectedLabel}</span>
          ) : (
            <span className="text-muted-foreground">
              Buscar compra por proveedor, factura...
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <div className="flex items border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Buscar por proveedor, factura o producto..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="border-0 bg-transparent pl-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {results.length === 0 && !isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No se encontraron compras
            </div>
          ) : (
            results.map((compra) => (
              <button
                key={compra.compraDocumentoId}
                onClick={() => {
                  onSelect(compra.compraDocumentoId);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent',
                  selectedId === compra.compraDocumentoId && 'bg-accent',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">
                      {compra.proveedorNombre ?? 'Sin proveedor'}
                    </span>
                    <span className="ml-2 whitespace-nowrap font-mono text-xs text-muted-foreground">
                      ${compra.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{compra.numeroFactura || 'S/N'}</span>
                    <span>·</span>
                    <span>{format(new Date(compra.fechaCompra), 'dd/MM/yyyy')}</span>
                    <span>·</span>
                    <span>{compra.itemsCount} producto(s)</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {compra.productos.slice(0, 3).map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {p}
                      </span>
                    ))}
                    {compra.productos.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{compra.productos.length - 3} más
                      </span>
                    )}
                  </div>
                </div>
                {selectedId === compra.compraDocumentoId && (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
