/**
 * @description Página de gestión de plantillas y variantes de inventario.
 * @returns {Promise<JSX.Element>} Vista de variantes o aviso de plan.
 */
import { redirect } from 'next/navigation';
import type { JSX } from 'react';

import { getAlmacenesAction } from '@/features/almacenes';
import { getCategoriasAction } from '@/features/categorias';
import { getPlantillasVariantesAction } from '@/features/productos/actions-variantes';
import { VariantesPageClient } from '@/features/productos/components/variantes-page-client';
import type { PlantillaVariantes } from '@/features/productos/types-variantes';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';

export const metadata = { title: 'Variantes de producto - Inventario' };
export const dynamic = 'force-dynamic';

export default async function VariantesPage(): Promise<JSX.Element> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const habilitado = user.role === 'admin' || user.planFeatures?.variantes === true;
  if (!habilitado) {
    return (
      <main className="mx-auto max-w-3xl space-y-3 p-6">
        <h1 className="text-2xl font-bold">Variantes de producto</h1>
        <p className="text-muted-foreground">
          Esta función está disponible en los planes Profesional y Empresarial.
        </p>
      </main>
    );
  }

  const [plantillasResult, categoriasResult, almacenesResult] = await Promise.all([
    getPlantillasVariantesAction(),
    getCategoriasAction(),
    getAlmacenesAction(),
  ]);
  const plantillas = (plantillasResult.success ? plantillasResult.data ?? [] : []) as unknown as PlantillaVariantes[];
  const categorias = categoriasResult.success
    ? (categoriasResult.data ?? []).map((categoria) => ({
        id: categoria.catId,
        nombre: categoria.nombre,
      }))
    : [];
  const almacenes = almacenesResult.success
    ? (almacenesResult.data ?? []).map((almacen) => ({
        id: almacen.almacenId,
        nombre: almacen.nombre,
      }))
    : [];

  return (
    <VariantesPageClient
      plantillasIniciales={plantillas}
      categorias={categorias}
      almacenes={almacenes}
      puedeGestionar={user.role === 'admin' || user.tenantRole === 'manager'}
    />
  );
}
