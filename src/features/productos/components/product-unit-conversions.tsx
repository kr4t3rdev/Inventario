'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { sileo } from '@/lib/sileo-shim';
import {
  createProductUnitConversionAction,
  deleteProductUnitConversionAction,
  getProductUnitConversionsAction,
  updateProductUnitConversionAction,
} from '@/features/productos/actions';

interface UnitOption { unidadId: string; nombre: string; simbolo: string }
interface ConversionRow { id: string; unidadId: string; factorAStock: unknown; unidad: UnitOption }

interface ProductUnitConversionsProps { productId: string }

/** @description Configures product-specific purchase-to-stock unit factors. */
export function ProductUnitConversions({ productId }: ProductUnitConversionsProps): React.JSX.Element {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [rows, setRows] = useState<ConversionRow[]>([]);
  const [unitId, setUnitId] = useState('');
  const [factor, setFactor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getProductUnitConversionsAction(productId);
      if (!result.success) throw new Error(result.error.message || 'No se pudieron cargar las conversiones.');
      setRows(result.data.conversions);
      setUnits(result.data.units as UnitOption[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las conversiones.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { void load(); }, [load]);

  const addConversion = async () => {
    setSaving(true);
    try {
      const result = await createProductUnitConversionAction({ productoId: productId, unidadId: unitId, factorAStock: factor });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo guardar la conversión.');
      setUnitId('');
      setFactor('');
      await load();
    } catch (cause) {
      sileo.error({ title: cause instanceof Error ? cause.message : 'No se pudo guardar la conversión.' });
    } finally {
      setSaving(false);
    }
  };

  const saveFactor = async (row: ConversionRow, nextFactor: string) => {
    setSaving(true);
    try {
      const result = await updateProductUnitConversionAction({ id: row.id, productoId: productId, unidadId: row.unidadId, factorAStock: nextFactor });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo actualizar la conversión.');
      await load();
    } catch (cause) {
      sileo.error({ title: cause instanceof Error ? cause.message : 'No se pudo actualizar la conversión.' });
    } finally {
      setSaving(false);
    }
  };

  const removeConversion = async (id: string) => {
    setSaving(true);
    try {
      const result = await deleteProductUnitConversionAction({ id, productoId: productId });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo eliminar la conversión.');
      await load();
    } catch (cause) {
      sileo.error({ title: cause instanceof Error ? cause.message : 'No se pudo eliminar la conversión.' });
    } finally {
      setSaving(false);
    }
  };

  return <section className="space-y-3 rounded-md border p-4" aria-label="Conversiones de unidades">
    <div>
      <h3 className="font-medium">Unidades de compra</h3>
      <p className="text-sm text-muted-foreground">Configura cuántas unidades de inventario contiene cada presentación.</p>
    </div>
    {loading ? <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Cargando conversiones…</p> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {!loading && rows.map((row) => <div key={row.id} className="flex items-center gap-2">
      <span className="min-w-0 flex-1 text-sm">{row.unidad.nombre} ({row.unidad.simbolo})</span>
      <span className="text-xs text-muted-foreground">contiene</span>
      <Input aria-label={`Factor de ${row.unidad.nombre}`} className="w-28" defaultValue={String(row.factorAStock)} disabled={saving}
        onBlur={(event) => { if (event.target.value !== String(row.factorAStock)) void saveFactor(row, event.target.value); }} />
      <Button type="button" variant="ghost" size="icon" aria-label={`Eliminar ${row.unidad.nombre}`} disabled={saving} onClick={() => void removeConversion(row.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>)}
    {!loading && units.length > 0 ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_auto]">
      <Select value={unitId} onValueChange={setUnitId} disabled={saving}>
        <SelectTrigger aria-label="Unidad de compra"><SelectValue placeholder="Selecciona una unidad" /></SelectTrigger>
        <SelectContent>{units.filter((unit) => !rows.some((row) => row.unidadId === unit.unidadId)).map((unit) =>
          <SelectItem key={unit.unidadId} value={unit.unidadId}>{unit.nombre} ({unit.simbolo})</SelectItem>)}</SelectContent>
      </Select>
      <Input aria-label="Factor a inventario" inputMode="decimal" placeholder="Factor" value={factor} onChange={(event) => setFactor(event.target.value)} disabled={saving} />
      <Button type="button" disabled={saving || !unitId || !factor} onClick={() => void addConversion()}><Plus className="mr-1 h-4 w-4" />Agregar</Button>
    </div> : null}
  </section>;
}
