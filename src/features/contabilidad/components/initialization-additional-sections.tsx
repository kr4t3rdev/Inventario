'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface InitialInventoryDraft {
  referenciaFila: string;
  productoId: string;
  almacenId: string;
  loteCodigo: string;
  cantidad: string;
  costoUnitario: string;
  moneda: string;
  tasaCambio: string;
  ubicacionId: string;
  fechaCorte: string;
  fechaVencimiento: string;
}

export interface InitialReceivableDraft {
  referenciaFila: string;
  clienteId: string;
  referenciaExterna: string;
  moneda: string;
  saldo: string;
  fechaVencimiento: string;
  tasaCambio: string;
  tasaInteres: string;
  tasaInteresMoratorio: string;
}

export interface InitialPayableDraft {
  referenciaFila: string;
  proveedorId: string;
  referenciaExterna: string;
  moneda: string;
  saldo: string;
  fechaVencimiento: string;
  tasaCambio: string;
}

/**
 * @description Crea una fila de inventario vacía con una referencia estable.
 * @returns Borrador de inventario listo para edición.
 */
export function newInitialInventoryDraft(): InitialInventoryDraft {
  return {
    referenciaFila: crypto.randomUUID(), productoId: '', almacenId: '', loteCodigo: '',
    cantidad: '', costoUnitario: '', moneda: 'CUP', tasaCambio: '', ubicacionId: '',
    fechaCorte: '', fechaVencimiento: '',
  };
}

/**
 * @description Normaliza una fila parcial de inventario guardada como borrador.
 * @param raw - Fila persistida que puede omitir campos aún no completados.
 * @returns Fila editable con valores de texto seguros y fechas opcionales preservadas.
 */
export function toInitialInventoryDraft(raw: unknown): InitialInventoryDraft {
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const defaults = newInitialInventoryDraft();
  return {
    referenciaFila: typeof row.referenciaFila === 'string' ? row.referenciaFila : defaults.referenciaFila,
    productoId: typeof row.productoId === 'string' ? row.productoId : '',
    almacenId: typeof row.almacenId === 'string' ? row.almacenId : '',
    loteCodigo: typeof row.loteCodigo === 'string' ? row.loteCodigo : '',
    cantidad: typeof row.cantidad === 'string' ? row.cantidad : '',
    costoUnitario: typeof row.costoUnitario === 'string' ? row.costoUnitario : '',
    moneda: typeof row.moneda === 'string' ? row.moneda : 'CUP',
    tasaCambio: typeof row.tasaCambio === 'string' ? row.tasaCambio : '',
    ubicacionId: typeof row.ubicacionId === 'string' ? row.ubicacionId : '',
    fechaCorte: typeof row.fechaCorte === 'string' ? row.fechaCorte : '',
    fechaVencimiento: typeof row.fechaVencimiento === 'string' ? row.fechaVencimiento : '',
  };
}

/**
 * @description Crea una fila vacía de cuentas por cobrar.
 * @returns Borrador de CxC listo para edición.
 */
export function newInitialReceivableDraft(): InitialReceivableDraft {
  return {
    referenciaFila: crypto.randomUUID(), clienteId: '', referenciaExterna: '', moneda: 'CUP',
    saldo: '', fechaVencimiento: '', tasaCambio: '', tasaInteres: '', tasaInteresMoratorio: '',
  };
}

/**
 * @description Normaliza una fila parcial de CxC para permitir completar el borrador.
 * @param raw - Fila persistida que puede omitir campos aún no completados.
 * @returns Fila editable con sus textos y tasas preservados.
 */
export function toInitialReceivableDraft(raw: unknown): InitialReceivableDraft {
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const text = (key: keyof InitialReceivableDraft) =>
    typeof row[key] === 'string' ? row[key] as string : '';
  return {
    referenciaFila: text('referenciaFila') || crypto.randomUUID(),
    clienteId: text('clienteId'), referenciaExterna: text('referenciaExterna'),
    moneda: text('moneda') || 'CUP', saldo: text('saldo'),
    fechaVencimiento: text('fechaVencimiento'), tasaCambio: text('tasaCambio'),
    tasaInteres: text('tasaInteres'), tasaInteresMoratorio: text('tasaInteresMoratorio'),
  };
}

/**
 * @description Crea una fila vacía de cuentas por pagar.
 * @returns Borrador de CxP listo para edición.
 */
export function newInitialPayableDraft(): InitialPayableDraft {
  return {
    referenciaFila: crypto.randomUUID(), proveedorId: '', referenciaExterna: '', moneda: 'CUP',
    saldo: '', fechaVencimiento: '', tasaCambio: '',
  };
}

/**
 * @description Normaliza una fila parcial de CxP para permitir completar el borrador.
 * @param raw - Fila persistida que puede omitir campos aún no completados.
 * @returns Fila editable con sus textos y fechas preservados.
 */
export function toInitialPayableDraft(raw: unknown): InitialPayableDraft {
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const text = (key: keyof InitialPayableDraft) =>
    typeof row[key] === 'string' ? row[key] as string : '';
  return {
    referenciaFila: text('referenciaFila') || crypto.randomUUID(),
    proveedorId: text('proveedorId'), referenciaExterna: text('referenciaExterna'),
    moneda: text('moneda') || 'CUP', saldo: text('saldo'),
    fechaVencimiento: text('fechaVencimiento'), tasaCambio: text('tasaCambio'),
  };
}

interface LookupOption {
  id: string;
  nombre: string;
}

interface InitializationAdditionalSectionsProps {
  canInventory: boolean;
  canReceivable: boolean;
  canLoanReceivable: boolean;
  canPayable: boolean;
  monedaFuncional: string;
  currencies: string[];
  products: LookupOption[];
  warehouses: LookupOption[];
  clients: LookupOption[];
  vendors: LookupOption[];
  inventory: InitialInventoryDraft[];
  receivables: InitialReceivableDraft[];
  payables: InitialPayableDraft[];
  onInventoryChange: (rows: InitialInventoryDraft[]) => void;
  onReceivablesChange: (rows: InitialReceivableDraft[]) => void;
  onPayablesChange: (rows: InitialPayableDraft[]) => void;
}

/**
 * @description Edita inventario, CxC y CxP iniciales según las capacidades del plan.
 * @param props - Features, opciones del tenant, filas y actualizadores inmutables.
 * @returns Apartados opcionales de carga inicial.
 */
export function InitializationAdditionalSections({
  canInventory,
  canReceivable,
  canLoanReceivable,
  canPayable,
  monedaFuncional,
  currencies,
  products,
  warehouses,
  clients,
  vendors,
  inventory,
  receivables,
  payables,
  onInventoryChange,
  onReceivablesChange,
  onPayablesChange,
}: InitializationAdditionalSectionsProps) {
  /** @description Actualiza una fila de inventario sin mutar el borrador. */
  const updateInventory = (index: number, patch: Partial<InitialInventoryDraft>) =>
    onInventoryChange(inventory.map((row, current) => current === index ? { ...row, ...patch } : row));
  /** @description Actualiza una fila de CxC sin mutar el borrador. */
  const updateReceivable = (index: number, patch: Partial<InitialReceivableDraft>) =>
    onReceivablesChange(receivables.map((row, current) => current === index ? { ...row, ...patch } : row));
  /** @description Actualiza una fila de CxP sin mutar el borrador. */
  const updatePayable = (index: number, patch: Partial<InitialPayableDraft>) =>
    onPayablesChange(payables.map((row, current) => current === index ? { ...row, ...patch } : row));
  /** @description Renderiza un selector de moneda con etiqueta visible. */
  const currencySelect = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>{currencies.map((currency) => (
          <SelectItem key={currency} value={currency}>{currency}</SelectItem>
        ))}</SelectContent>
      </Select>
    </label>
  );
  /** @description Renderiza un campo de texto con etiqueta visible y accesible. */
  const input = (label: string, value: string, onChange: (value: string) => void, type = 'text') => (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input aria-label={label} type={type} inputMode={type === 'text' ? 'decimal' : undefined}
        value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
  /** @description Renderiza un selector de opciones con etiqueta visible. */
  const selector = (
    label: string,
    value: string,
    options: LookupOption[],
    onChange: (value: string) => void,
  ) => (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}><SelectValue placeholder="Seleccione" /></SelectTrigger>
        <SelectContent>{options.map((option) => (
          <SelectItem key={option.id} value={option.id}>{option.nombre}</SelectItem>
        ))}</SelectContent>
      </Select>
    </label>
  );
  /** @description Renderiza la acción accesible para retirar una fila. */
  const removeButton = (label: string, onClick: () => void) => (
    <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onClick}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="space-y-4">
      {canInventory && (
        <section className="space-y-3 rounded-md border p-4" aria-label="Inventario inicial">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Inventario inicial</h3>
            <Button type="button" variant="outline" onClick={() => onInventoryChange([...inventory, newInitialInventoryDraft()])}>
              <Plus className="mr-2 h-4 w-4" />Agregar fila de inventario
            </Button>
          </div>
          {inventory.map((row, index) => (
            <div key={row.referenciaFila} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
              <span className="text-sm font-medium">Existencia {index + 1}</span>
              {removeButton(`Eliminar existencia ${index + 1}`, () => onInventoryChange(inventory.filter((_, i) => i !== index)))}
              {selector('Producto inicial', row.productoId, products, (productoId) => updateInventory(index, { productoId }))}
              {selector('Almacén inicial', row.almacenId, warehouses, (almacenId) => updateInventory(index, { almacenId }))}
              {input('Lote inicial', row.loteCodigo, (loteCodigo) => updateInventory(index, { loteCodigo }))}
              {input('Cantidad inicial', row.cantidad, (cantidad) => updateInventory(index, { cantidad }))}
              {input('Costo unitario inicial', row.costoUnitario, (costoUnitario) => updateInventory(index, { costoUnitario }))}
              {currencySelect('Moneda del inventario', row.moneda, (moneda) => updateInventory(index, { moneda }))}
              {input('Vencimiento del lote', row.fechaVencimiento,
                (fechaVencimiento) => updateInventory(index, { fechaVencimiento }), 'date')}
              {row.moneda !== monedaFuncional && input('Tasa de cambio del inventario', row.tasaCambio,
                (tasaCambio) => updateInventory(index, { tasaCambio }))}
            </div>
          ))}
        </section>
      )}
      {canReceivable && (
        <section className="space-y-3 rounded-md border p-4" aria-label="Cuentas por cobrar iniciales">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Cuentas por cobrar iniciales</h3>
            <Button type="button" variant="outline" onClick={() => onReceivablesChange([...receivables, newInitialReceivableDraft()])}>
              <Plus className="mr-2 h-4 w-4" />Agregar cuenta por cobrar
            </Button>
          </div>
          {receivables.map((row, index) => (
            <div key={row.referenciaFila} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
              <span className="text-sm font-medium">Cuenta por cobrar {index + 1}</span>
              {removeButton(`Eliminar cuenta por cobrar ${index + 1}`, () => onReceivablesChange(receivables.filter((_, i) => i !== index)))}
              {selector('Cliente de cuenta por cobrar', row.clienteId, clients, (clienteId) => updateReceivable(index, { clienteId }))}
              {input('Referencia externa de CxC', row.referenciaExterna, (referenciaExterna) => updateReceivable(index, { referenciaExterna }))}
              {input('Saldo inicial de CxC', row.saldo, (saldo) => updateReceivable(index, { saldo }))}
              {currencySelect('Moneda de CxC', row.moneda, (moneda) => updateReceivable(index, { moneda }))}
              {input('Vencimiento de CxC', row.fechaVencimiento, (fechaVencimiento) => updateReceivable(index, { fechaVencimiento }), 'date')}
              {row.moneda !== monedaFuncional && input('Tasa de cambio de CxC', row.tasaCambio,
                (tasaCambio) => updateReceivable(index, { tasaCambio }))}
              {canLoanReceivable && <>
                {input('Interés ordinario del préstamo', row.tasaInteres,
                  (tasaInteres) => updateReceivable(index, { tasaInteres }))}
                {input('Interés moratorio del préstamo', row.tasaInteresMoratorio,
                  (tasaInteresMoratorio) => updateReceivable(index, { tasaInteresMoratorio }))}
              </>}
            </div>
          ))}
        </section>
      )}
      {canPayable && (
        <section className="space-y-3 rounded-md border p-4" aria-label="Cuentas por pagar iniciales">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Cuentas por pagar iniciales</h3>
            <Button type="button" variant="outline" onClick={() => onPayablesChange([...payables, newInitialPayableDraft()])}>
              <Plus className="mr-2 h-4 w-4" />Agregar cuenta por pagar
            </Button>
          </div>
          {payables.map((row, index) => (
            <div key={row.referenciaFila} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
              <span className="text-sm font-medium">Cuenta por pagar {index + 1}</span>
              {removeButton(`Eliminar cuenta por pagar ${index + 1}`, () => onPayablesChange(payables.filter((_, i) => i !== index)))}
              {selector('Proveedor de cuenta por pagar', row.proveedorId, vendors, (proveedorId) => updatePayable(index, { proveedorId }))}
              {input('Referencia externa de CxP', row.referenciaExterna, (referenciaExterna) => updatePayable(index, { referenciaExterna }))}
              {input('Saldo inicial de CxP', row.saldo, (saldo) => updatePayable(index, { saldo }))}
              {currencySelect('Moneda de CxP', row.moneda, (moneda) => updatePayable(index, { moneda }))}
              {input('Vencimiento de CxP', row.fechaVencimiento, (fechaVencimiento) => updatePayable(index, { fechaVencimiento }), 'date')}
              {row.moneda !== monedaFuncional && input('Tasa de cambio de CxP', row.tasaCambio,
                (tasaCambio) => updatePayable(index, { tasaCambio }))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
