'use client';

import { useState, useTransition } from 'react';
import type { JSX } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { updateVarianteCatalogoAction } from '@/features/productos/actions-variantes';
import type { PlantillaVariantes, VarianteCatalogo } from '@/features/productos/types-variantes';

interface VariantesMatrixProps {
  plantilla: PlantillaVariantes;
  onVariantUpdated: (producto: VarianteCatalogo) => void;
}

/**
 * @description Muestra la matriz SKU/atributos/precio/stock de una plantilla.
 * @param {VariantesMatrixProps} props - Plantilla y callback de actualización.
 * @returns {JSX.Element} Tabla adaptable de variantes.
 */
export function VariantesMatrix({
  plantilla,
  onVariantUpdated,
}: VariantesMatrixProps): JSX.Element {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5" aria-labelledby={`plantilla-${plantilla.id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`plantilla-${plantilla.id}`} className="text-lg font-semibold">{plantilla.nombre}</h2>
        <span className="text-sm text-muted-foreground">{plantilla.productos.length} variantes</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th scope="col" className="p-2">Atributos</th>
              <th scope="col" className="p-2">SKU</th>
              <th scope="col" className="p-2">Costo</th>
              <th scope="col" className="p-2">Precio</th>
              <th scope="col" className="p-2">Stock disponible</th>
              <th scope="col" className="p-2">Listas</th>
              <th scope="col" className="p-2"><span className="sr-only">Guardar cambios</span></th>
            </tr>
          </thead>
          <tbody>
            {plantilla.productos.map((producto) => (
              <VariantRow key={producto.id} producto={producto} onUpdated={onVariantUpdated} />
            ))}
          </tbody>
        </table>
      </div>
      {plantilla.productos.length === 0 && (
        <p className="text-sm text-muted-foreground">Esta plantilla todavía no tiene variantes.</p>
      )}
    </section>
  );
}

interface VariantRowProps {
  producto: VarianteCatalogo;
  onUpdated: (producto: VarianteCatalogo) => void;
}

/**
 * @description Fila editable de SKU y precios base para una variante.
 * @param {VariantRowProps} props - Producto variante y callback de actualización.
 * @returns {JSX.Element} Fila de la matriz.
 */
function VariantRow({ producto, onUpdated }: VariantRowProps): JSX.Element {
  const [sku, setSku] = useState(producto.sku ?? '');
  const [precioCosto, setPrecioCosto] = useState(String(producto.precioCosto));
  const [precioVenta, setPrecioVenta] = useState(String(producto.precioVenta));
  const [isPending, startTransition] = useTransition();
  const atributos = Object.entries(producto.atributoJson ?? {})
    .map(([name, value]) => `${name}: ${value}`)
    .join(' · ');

  const guardar = () => startTransition(async () => {
    const result = await updateVarianteCatalogoAction({
      productoId: producto.id,
      sku,
      precioCosto: Number(precioCosto),
      precioVenta: Number(precioVenta),
    });
    if (result.success === false) {
      toast.error(result.error?.message ?? 'No se pudieron guardar los cambios');
      return;
    }
    onUpdated({ ...producto, ...(result.data as VarianteCatalogo) });
    toast.success('Variante actualizada');
  });

  return (
    <tr className="border-b last:border-0">
      <th scope="row" className="p-2 font-medium">{atributos || producto.nombre}</th>
      <td className="p-2"><input aria-label={`SKU de ${producto.nombre}`} value={sku} onChange={(event) => setSku(event.target.value)} maxLength={100} className="w-36 rounded border bg-background px-2 py-1" /></td>
      <td className="p-2"><input aria-label={`Costo de ${producto.nombre}`} type="number" min="0" value={precioCosto} onChange={(event) => setPrecioCosto(event.target.value)} className="w-24 rounded border bg-background px-2 py-1" /></td>
      <td className="p-2"><input aria-label={`Precio de ${producto.nombre}`} type="number" min="0" value={precioVenta} onChange={(event) => setPrecioVenta(event.target.value)} className="w-24 rounded border bg-background px-2 py-1" /></td>
      <td className="p-2 tabular-nums">{producto.stockTotal}</td>
      <td className="p-2"><Link className="text-primary underline-offset-4 hover:underline" href={`/busy/products/edit/${producto.id}`}>Editar precios por lista</Link></td>
      <td className="p-2 text-right">
        <Button type="button" size="sm" variant="outline" disabled={isPending || !sku.trim()} onClick={guardar}>
          {isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </td>
    </tr>
  );
}
