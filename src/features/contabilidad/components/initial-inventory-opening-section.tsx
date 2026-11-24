'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  newInitialInventoryDraft,
  type InitialInventoryDraft,
} from '../services/initialization-additional-drafts';

interface LookupOption {
  id: string;
  nombre: string;
}

interface InitialInventoryOpeningSectionProps {
  rows: InitialInventoryDraft[];
  products: LookupOption[];
  warehouses: LookupOption[];
  currencies: string[];
  functionalCurrency: string;
  onChange: (rows: InitialInventoryDraft[]) => void;
}

/**
 * @description Captura existencias iniciales ligadas a productos y almacenes existentes.
 * @param props - Borradores, opciones permitidas y callback inmutable de cambios.
 * @returns Sección accesible para registrar, editar y retirar existencias iniciales.
 */
export function InitialInventoryOpeningSection({
  rows,
  products,
  warehouses,
  currencies,
  functionalCurrency,
  onChange,
}: InitialInventoryOpeningSectionProps): ReactElement {
  /** @description Actualiza una fila conservando las demás referencias. */
  const updateRow = (index: number, patch: Partial<InitialInventoryDraft>) =>
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));

  return (
    <section className="space-y-3 rounded-md border p-4" aria-label="Inventario inicial">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Inventario inicial</h3>
        <Button type="button" variant="outline" onClick={() => onChange([...rows, newInitialInventoryDraft()])}>
          <Plus className="mr-2 h-4 w-4" />Agregar fila de inventario
        </Button>
      </div>
      {rows.map((row, index) => (
        <div key={row.referenciaFila} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
          <span className="text-sm font-medium">Existencia {index + 1}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Eliminar existencia ${index + 1}`}
            onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <div className="space-y-1 text-sm">
            <span className="font-medium">Producto inicial</span>
            <Select value={row.productoId} onValueChange={(productoId) => updateRow(index, { productoId })}>
              <SelectTrigger aria-label="Producto inicial"><SelectValue placeholder="Seleccione" /></SelectTrigger>
              <SelectContent>{products.map((option) => (
                <SelectItem key={option.id} value={option.id}>{option.nombre}</SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 text-sm">
            <span className="font-medium">Almacén inicial</span>
            <Select value={row.almacenId} onValueChange={(almacenId) => updateRow(index, { almacenId })}>
              <SelectTrigger aria-label="Almacén inicial"><SelectValue placeholder="Seleccione" /></SelectTrigger>
              <SelectContent>{warehouses.map((option) => (
                <SelectItem key={option.id} value={option.id}>{option.nombre}</SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
          {([
            ['Lote inicial', 'loteCodigo'], ['Cantidad inicial', 'cantidad'],
            ['Costo unitario inicial', 'costoUnitario'],
          ] as const).map(([label, key]) => (
            <label key={key} className="space-y-1 text-sm">
              <span className="font-medium">{label}</span>
              <Input
                aria-label={label}
                inputMode={key === 'loteCodigo' ? undefined : 'decimal'}
                value={row[key]}
                onChange={(event) => updateRow(index, { [key]: event.target.value })}
              />
            </label>
          ))}
          <div className="space-y-1 text-sm">
            <span className="font-medium">Moneda del inventario</span>
            <Select value={row.moneda} onValueChange={(moneda) => updateRow(index, { moneda })}>
              <SelectTrigger aria-label="Moneda del inventario"><SelectValue /></SelectTrigger>
              <SelectContent>{currencies.map((currency) => (
                <SelectItem key={currency} value={currency}>{currency}</SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Vencimiento del lote</span>
            <Input
              aria-label="Vencimiento del lote"
              type="date"
              value={row.fechaVencimiento}
              onChange={(event) => updateRow(index, { fechaVencimiento: event.target.value })}
            />
          </label>
          {row.moneda !== functionalCurrency && (
            <label className="space-y-1 text-sm">
              <span className="font-medium">Tasa de cambio del inventario</span>
              <Input
                aria-label="Tasa de cambio del inventario"
                inputMode="decimal"
                value={row.tasaCambio}
                onChange={(event) => updateRow(index, { tasaCambio: event.target.value })}
              />
            </label>
          )}
        </div>
      ))}
    </section>
  );
}
