'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  newInitialReceivableDraft,
  type InitialReceivableDraft,
} from '../services/initialization-additional-drafts';

interface LookupOption {
  id: string;
  nombre: string;
}

interface InitialReceivablesOpeningSectionProps {
  rows: InitialReceivableDraft[];
  clients: LookupOption[];
  currencies: string[];
  functionalCurrency: string;
  canLoanReceivable: boolean;
  onChange: (rows: InitialReceivableDraft[]) => void;
}

/**
 * @description Captura saldos iniciales pendientes de cobro de clientes existentes.
 * @param props - Borradores, opciones del tenant, monedas y acceso a préstamos.
 * @returns Sección para registrar, editar y retirar cuentas por cobrar iniciales.
 */
export function InitialReceivablesOpeningSection({
  rows,
  clients,
  currencies,
  functionalCurrency,
  canLoanReceivable,
  onChange,
}: InitialReceivablesOpeningSectionProps): ReactElement {
  /** @description Actualiza una fila sin modificar las demás. */
  const updateRow = (index: number, patch: Partial<InitialReceivableDraft>) =>
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));

  return (
    <section className="space-y-3 rounded-md border p-4" aria-label="Cuentas por cobrar iniciales">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Cuentas por cobrar iniciales</h3>
        <Button type="button" variant="outline" onClick={() => onChange([...rows, { ...newInitialReceivableDraft(), moneda: functionalCurrency }])}>
          <Plus className="mr-2 h-4 w-4" />Agregar cuenta por cobrar
        </Button>
      </div>
      {rows.map((row, index) => (
        <div key={row.referenciaFila} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
          <span className="text-sm font-medium">Cuenta por cobrar {index + 1}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Eliminar cuenta por cobrar ${index + 1}`}
            onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <div className="space-y-1 text-sm">
            <span className="font-medium">Cliente de cuenta por cobrar</span>
            <Select value={row.clienteId} onValueChange={(clienteId) => updateRow(index, { clienteId })}>
              <SelectTrigger aria-label="Cliente de cuenta por cobrar">
                <SelectValue placeholder="Seleccione" />
              </SelectTrigger>
              <SelectContent>{clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>{client.nombre}</SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
          {([
            ['Referencia externa de CxC', 'referenciaExterna', undefined],
            ['Saldo inicial de CxC', 'saldo', 'decimal'],
          ] as const).map(([label, key, inputMode]) => (
            <label key={key} className="space-y-1 text-sm">
              <span className="font-medium">{label}</span>
              <Input
                aria-label={label}
                inputMode={inputMode}
                value={row[key]}
                onChange={(event) => updateRow(index, { [key]: event.target.value })}
              />
            </label>
          ))}
          <div className="space-y-1 text-sm">
            <span className="font-medium">Moneda de CxC</span>
            <Select value={row.moneda} onValueChange={(moneda) => updateRow(index, { moneda })}>
              <SelectTrigger aria-label="Moneda de CxC"><SelectValue /></SelectTrigger>
              <SelectContent>{currencies.map((currency) => (
                <SelectItem key={currency} value={currency}>{currency}</SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Vencimiento de CxC</span>
            <Input
              aria-label="Vencimiento de CxC"
              type="date"
              value={row.fechaVencimiento}
              onChange={(event) => updateRow(index, { fechaVencimiento: event.target.value })}
            />
          </label>
          {row.moneda !== functionalCurrency && (
            <label className="space-y-1 text-sm">
              <span className="font-medium">Tasa de cambio de CxC</span>
              <Input
                aria-label="Tasa de cambio de CxC"
                inputMode="decimal"
                value={row.tasaCambio}
                onChange={(event) => updateRow(index, { tasaCambio: event.target.value })}
              />
            </label>
          )}
          {canLoanReceivable && ([
            ['Interés ordinario del préstamo', 'tasaInteres'],
            ['Interés moratorio del préstamo', 'tasaInteresMoratorio'],
          ] as const).map(([label, key]) => (
            <label key={key} className="space-y-1 text-sm">
              <span className="font-medium">{label}</span>
              <Input
                aria-label={label}
                inputMode="decimal"
                value={row[key]}
                onChange={(event) => updateRow(index, { [key]: event.target.value })}
              />
            </label>
          ))}
        </div>
      ))}
    </section>
  );
}
