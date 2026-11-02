'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getProductosAction } from '@/features/productos/actions';
import { getServiciosAction } from '@/features/servicios/actions';
import { updateOfertaAction } from '@/features/ofertas/actions';
import type { Oferta } from '@/app/models/model';
import { toast } from 'sonner';

interface OfertaItemsEditorProps {
  oferta: Oferta;
  onSaved: (oferta: Oferta) => void;
  disabled?: boolean;
}

interface CatalogItem {
  id: string;
  nombre: string;
}

interface EditableItem {
  tipo: 'producto' | 'servicio';
  itemId: string;
  cantidad: number;
}

/**
 * @description Permite editar los ítems de una oferta pendiente desde su detalle.
 * Los precios y totales se resuelven de nuevo en el servidor al guardar.
 * @param {OfertaItemsEditorProps} props - Oferta y callback para refrescar el detalle.
 * @returns {JSX.Element} Botón y diálogo de edición de ítems.
 */
export function OfertaItemsEditor({ oferta, onSaved, disabled = false }: OfertaItemsEditorProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [productos, setProductos] = useState<CatalogItem[]>([]);
  const [servicios, setServicios] = useState<CatalogItem[]>([]);
  const [impuestos, setImpuestos] = useState(Number(oferta.impuestos ?? 0));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItems(oferta.items.map((item) => ({
      tipo: item.productoId ? 'producto' : 'servicio',
      itemId: item.productoId ?? item.servicioId ?? '',
      cantidad: item.cantidad,
    })));
    setImpuestos(Number(oferta.impuestos ?? 0));
    setLoading(true);
    Promise.all([getProductosAction(), getServiciosAction()])
      .then(([productosResult, serviciosResult]) => {
        if (productosResult.success) {
          setProductos((productosResult.data ?? []).map((item) => ({ id: item.id, nombre: item.nombre })));
        }
        if (serviciosResult.success) {
          setServicios((serviciosResult.data ?? []).map((item) => ({ id: item.servicioId, nombre: item.nombre })));
        }
      })
      .catch(() => toast.error('No se pudo cargar el catálogo'))
      .finally(() => setLoading(false));
  }, [open, oferta]);

  const save = async () => {
    if (items.some((item) => !item.itemId || item.cantidad < 1)) {
      toast.error('Completa el producto o servicio y una cantidad válida en cada línea');
      return;
    }
    setSaving(true);
    try {
      const result = await updateOfertaAction({
        ofertaId: oferta.id,
        impuestos,
        items: items.map((item) => ({
          productoId: item.tipo === 'producto' ? item.itemId : undefined,
          servicioId: item.tipo === 'servicio' ? item.itemId : undefined,
          cantidad: item.cantidad,
        })),
      });
      if (!result.success) {
        toast.error(result.error?.message ?? 'No se pudieron guardar los ítems');
        return;
      }
      onSaved(result.data as Oferta);
      setOpen(false);
      toast.success('Ítems de la oferta actualizados');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={disabled}>
        <Pencil className="mr-2 h-4 w-4" /> Editar ítems
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar ítems de la oferta</DialogTitle>
            <DialogDescription>
              Los precios vigentes se volverán a consultar al guardar. Solo se pueden editar ofertas pendientes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {items.map((item, index) => {
              const catalog = item.tipo === 'producto' ? productos : servicios;
              return (
                <div key={`${index}-${item.itemId}`} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-4">
                    <label className="mb-1 block text-xs font-medium">Tipo</label>
                    <Select
                      value={item.tipo}
                      onValueChange={(value: 'producto' | 'servicio') => setItems((current) => current.map((row, i) => i === index ? { ...row, tipo: value, itemId: '' } : row))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="producto">Producto</SelectItem>
                        <SelectItem value="servicio">Servicio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-5">
                    <label className="mb-1 block text-xs font-medium">Artículo</label>
                    <Select
                      value={item.itemId}
                      onValueChange={(value) => setItems((current) => current.map((row, i) => i === index ? { ...row, itemId: value } : row))}
                      disabled={loading}
                    >
                      <SelectTrigger><SelectValue placeholder={loading ? 'Cargando catálogo…' : 'Seleccionar'} /></SelectTrigger>
                      <SelectContent>
                        {catalog.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium">Cantidad</label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={item.cantidad}
                      onChange={(event) => setItems((current) => current.map((row, i) => i === index ? { ...row, cantidad: Number(event.target.value) } : row))}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Eliminar línea" onClick={() => setItems((current) => current.filter((_, i) => i !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button type="button" variant="outline" onClick={() => setItems((current) => [...current, { tipo: 'producto', itemId: '', cantidad: 1 }])}>
              <Plus className="mr-2 h-4 w-4" /> Agregar ítem
            </Button>
            <div className="flex max-w-xs items-center justify-between gap-3 border-t pt-3">
              <label htmlFor="oferta-impuestos" className="text-sm font-medium">Impuestos</label>
              <Input id="oferta-impuestos" type="number" min={0} step="0.01" value={impuestos} onChange={(event) => setImpuestos(Number(event.target.value))} className="w-32 text-right" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving || loading || items.length === 0}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
