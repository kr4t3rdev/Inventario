'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { newInitialPayableDraft, type InitialPayableDraft } from '../services/initialization-additional-drafts';

interface LookupOption {
  id: string;
  nombre: string;
}

interface InitialPayablesOpeningSectionProps {
  rows: InitialPayableDraft[];
  suppliers: LookupOption[];
  currencies: string[];
  functionalCurrency: string;
  onChange: (rows: InitialPayableDraft[]) => void;
}

/**
 * @description Captura obligaciones iniciales pendientes de pago a proveedores existentes.
 * @param props - Borradores, proveedores, monedas disponibles y actualizador.
 * @returns Sección editable para registrar cuentas por pagar iniciales.
 */
export function InitialPayablesOpeningSection({
  rows, suppliers, currencies, functionalCurrency, onChange,
}: InitialPayablesOpeningSectionProps): ReactElement {
  /** @description Actualiza una fila sin modificar las demás. */
  const updateRow = (index: number, patch: Partial<InitialPayableDraft>) =>
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));

  return (
    <section className="space-y-3 rounded-md border p-4" aria-label="Cuentas por pagar iniciales">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Cuentas por pagar iniciales</h3>
        <Button type="button" variant="outline" onClick={() => onChange([
          ...rows, { ...newInitialPayableDraft(), moneda: functionalCurrency },
        ])}>
          <Plus className="mr-2 h-4 w-4" />Agregar cuenta por pagar
        </Button>
      </div>
      {rows.map((row, index) => (
        <div key={row.referenciaFila} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
          <span className="text-sm font-medium">Cuenta por pagar {index + 1}</span>
          <Button type="button" variant="ghost" size="icon"
            aria-label={`Eliminar cuenta por pagar ${index + 1}`}
            onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <div className="space-y-1 text-sm">
            <span className="font-medium">Proveedor de cuenta por pagar</span>
            <Select value={row.proveedorId} onValueChange={(proveedorId) => updateRow(index, { proveedorId })}>
              <SelectTrigger aria-label="Proveedor de cuenta por pagar"><SelectValue placeholder="Seleccione" /></SelectTrigger>
              <SelectContent>{suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>{supplier.nombre}</SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
          {([
            ['Referencia externa de CxP', 'referenciaExterna', undefined],
            ['Saldo inicial de CxP', 'saldo', 'decimal'],
          ] as const).map(([label, key, inputMode]) => (
            <label key={key} className="space-y-1 text-sm">
              <span className="font-medium">{label}</span>
              <Input aria-label={label} inputMode={inputMode} value={row[key]}
                onChange={(event) => updateRow(index, { [key]: event.target.value })} />
            </label>
          ))}
          <div className="space-y-1 text-sm">
            <span className="font-medium">Moneda de CxP</span>
            <Select value={row.moneda} onValueChange={(moneda) => updateRow(index, { moneda })}>
              <SelectTrigger aria-label="Moneda de CxP"><SelectValue /></SelectTrigger>
              <SelectContent>{currencies.map((currency) => (
                <SelectItem key={currency} value={currency}>{currency}</SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Vencimiento de CxP</span>
            <Input aria-label="Vencimiento de CxP" type="date" value={row.fechaVencimiento}
              onChange={(event) => updateRow(index, { fechaVencimiento: event.target.value })} />
          </label>
          {row.moneda !== functionalCurrency && (
            <label className="space-y-1 text-sm">
              <span className="font-medium">Tasa de cambio de CxP</span>
              <Input aria-label="Tasa de cambio de CxP" inputMode="decimal" value={row.tasaCambio}
                onChange={(event) => updateRow(index, { tasaCambio: event.target.value })} />
            </label>
          )}
        </div>
      ))}
    </section>
  );
}
