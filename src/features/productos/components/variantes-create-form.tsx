'use client';

import { useState, useTransition } from 'react';
import type { JSX } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { createPlantillaVariantesAction } from '@/features/productos/actions-variantes';
import type { PlantillaVariantes } from '@/features/productos/types-variantes';

interface CatalogOption {
  id: string;
  nombre: string;
}

interface VariantesCreateFormProps {
  categorias: CatalogOption[];
  almacenes: CatalogOption[];
  onCreated: (plantilla: PlantillaVariantes) => void;
}

/**
 * @description Formulario para crear una plantilla y generar su matriz cartesiana de variantes.
 * @param {VariantesCreateFormProps} props - Catálogos y callback de éxito.
 * @returns {JSX.Element} Formulario de generación de variantes.
 */
export function VariantesCreateForm({
  categorias,
  almacenes,
  onCreated,
}: VariantesCreateFormProps): JSX.Element {
  const [atributos, setAtributos] = useState([{ nombre: 'Talla', valores: 'S, M, L' }]);
  const [isPending, startTransition] = useTransition();

  const actualizarAtributo = (index: number, field: 'nombre' | 'valores', value: string) => {
    setAtributos((current) => current.map((attribute, i) =>
      i === index ? { ...attribute, [field]: value } : attribute,
    ));
  };

  const enviar = (formData: FormData) => {
    const atributosInput = atributos.map((attribute) => ({
      nombre: attribute.nombre,
      valores: attribute.valores.split(',').map((value) => value.trim()).filter(Boolean),
    }));
    const input = {
      nombrePlantilla: String(formData.get('nombrePlantilla') ?? ''),
      nombreProducto: String(formData.get('nombreProducto') ?? ''),
      skuPrefijo: String(formData.get('skuPrefijo') ?? ''),
      atributos: atributosInput,
      precioCosto: Number(formData.get('precioCosto') ?? 0),
      precioVenta: Number(formData.get('precioVenta') ?? 0),
      stockInicial: Number(formData.get('stockInicial') ?? 0),
      stockMinimo: Number(formData.get('stockMinimo') ?? 0),
      categoriaId: String(formData.get('categoriaId') ?? ''),
      almacenId: String(formData.get('almacenId') ?? ''),
      precios: [],
    };

    startTransition(async () => {
      const result = await createPlantillaVariantesAction(input);
      if (result.success === false) {
        toast.error(result.error?.message ?? 'No se pudo crear la plantilla');
        return;
      }
      const plantilla = result.data as unknown as PlantillaVariantes;
      onCreated({
        ...plantilla,
        productos: plantilla.productos.map((product) => ({
          ...product,
          stockTotal: product.stock,
        })),
      });
      toast.success(`Se generaron ${plantilla.productos.length} variantes`);
    });
  };

  return (
    <form action={enviar} className="space-y-5 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Nueva plantilla</h2>
        <p className="text-sm text-muted-foreground">
          Cada combinación se creará como un producto con SKU y stock propios.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Nombre de la plantilla</span>
          <input name="nombrePlantilla" required maxLength={200} className="w-full rounded-md border bg-background px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Nombre del producto</span>
          <input name="nombreProducto" required maxLength={200} className="w-full rounded-md border bg-background px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Prefijo SKU</span>
          <input name="skuPrefijo" required maxLength={60} placeholder="CAMISETA" className="w-full rounded-md border bg-background px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Categoría</span>
          <select name="categoriaId" required defaultValue="" className="w-full rounded-md border bg-background px-3 py-2">
            <option value="" disabled>Selecciona una categoría</option>
            {categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Almacén</span>
          <select name="almacenId" required defaultValue="" className="w-full rounded-md border bg-background px-3 py-2">
            <option value="" disabled>Selecciona un almacén</option>
            {almacenes.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Costo unitario</span>
          <input name="precioCosto" type="number" min="0" step="1" required defaultValue="0" className="w-full rounded-md border bg-background px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Precio de venta</span>
          <input name="precioVenta" type="number" min="0" step="1" required defaultValue="0" className="w-full rounded-md border bg-background px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Stock inicial por variante</span>
          <input name="stockInicial" type="number" min="0" step="1" required defaultValue="0" className="w-full rounded-md border bg-background px-3 py-2" />
        </label>
      </div>
      <section className="space-y-3" aria-label="Atributos de las variantes">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Atributos</h3>
          <Button type="button" variant="outline" onClick={() => setAtributos((items) => [...items, { nombre: '', valores: '' }])} disabled={atributos.length >= 5}>
            Agregar atributo
          </Button>
        </div>
        {atributos.map((attribute, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <label className="space-y-1 text-sm">
              <span>Nombre</span>
              <input value={attribute.nombre} onChange={(event) => actualizarAtributo(index, 'nombre', event.target.value)} required maxLength={40} className="w-full rounded-md border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span>Valores separados por coma</span>
              <input value={attribute.valores} onChange={(event) => actualizarAtributo(index, 'valores', event.target.value)} required placeholder="Rojo, Azul" className="w-full rounded-md border bg-background px-3 py-2" />
            </label>
            {atributos.length > 1 && (
              <Button type="button" variant="ghost" aria-label={`Eliminar atributo ${attribute.nombre || index + 1}`} onClick={() => setAtributos((items) => items.filter((_, i) => i !== index))}>
                Quitar
              </Button>
            )}
          </div>
        ))}
      </section>
      <Button type="submit" disabled={isPending || categorias.length === 0 || almacenes.length === 0}>
        {isPending ? 'Generando…' : 'Crear variantes'}
      </Button>
    </form>
  );
}
