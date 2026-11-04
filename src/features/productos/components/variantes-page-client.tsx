'use client';

import { useState } from 'react';
import type { JSX } from 'react';

import { VariantesCreateForm } from '@/features/productos/components/variantes-create-form';
import { VariantesMatrix } from '@/features/productos/components/variantes-matrix';
import type { PlantillaVariantes, VarianteCatalogo } from '@/features/productos/types-variantes';

interface VariantesPageClientProps {
  plantillasIniciales: PlantillaVariantes[];
  categorias: Array<{ id: string; nombre: string }>;
  almacenes: Array<{ id: string; nombre: string }>;
  puedeGestionar: boolean;
}

/**
 * @description Interfaz de gestión de plantillas y variantes por producto.
 * @param {VariantesPageClientProps} props - Plantillas y catálogos del tenant.
 * @returns {JSX.Element} Formulario y matrices de variantes.
 */
export function VariantesPageClient({
  plantillasIniciales,
  categorias,
  almacenes,
  puedeGestionar,
}: VariantesPageClientProps): JSX.Element {
  const [plantillas, setPlantillas] = useState(plantillasIniciales);

  const agregarPlantilla = (plantilla: PlantillaVariantes) => {
    setPlantillas((current) => [plantilla, ...current]);
  };

  const actualizarVariante = (updated: VarianteCatalogo) => {
    setPlantillas((current) => current.map((plantilla) => ({
      ...plantilla,
      productos: plantilla.productos.map((producto) =>
        producto.id === updated.id ? { ...producto, ...updated } : producto,
      ),
    })));
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header>
        <p className="text-sm font-medium text-primary">Inventario profesional</p>
        <h1 className="text-2xl font-bold tracking-tight">Variantes de producto</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Agrupa productos por talla, color u otros atributos. Cada variante tiene SKU,
          precios y stock independientes; la plantilla solo organiza el catálogo.
        </p>
      </header>

      {puedeGestionar && (
        <VariantesCreateForm
          categorias={categorias}
          almacenes={almacenes}
          onCreated={agregarPlantilla}
        />
      )}

      <div className="space-y-4" aria-label="Plantillas de variantes">
        {plantillas.map((plantilla) => (
          <VariantesMatrix
            key={plantilla.id}
            plantilla={plantilla}
            onVariantUpdated={actualizarVariante}
          />
        ))}
        {plantillas.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Todavía no hay plantillas. Crea una para generar variantes vendibles.
          </div>
        )}
      </div>
    </main>
  );
}
