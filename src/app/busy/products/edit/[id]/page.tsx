/**
 * @description Página de edición de producto (Server Component).
 *   Obtiene el producto por ID y catálogos en el servidor.
 * @param {{ params: Promise<{ id: string }> }} props - Parámetros de ruta con ID del producto.
 * @returns {Promise<JSX.Element>} Vista server-first del formulario de edición.
 */
import { getAlmacenesAction } from '@/features/almacenes'
import { getCategoriasAction } from '@/features/categorias'
import { getListasPreciosAction } from '@/features/listas-precios'
import { getProductoByIdAction } from '@/features/productos'
import { getUnidadesAction } from '@/features/unidades'
import type { Producto } from '@/features/productos/types'
import { getVendorsAction } from '@/features/vendors'
import { ProductoFormPageClient } from '@/features/productos/components/producto-form-page-client'


export const metadata = {
  title: "Editar Producto - FinanceTCP",
}

interface EditPageProps {
  params: Promise<{ id: string }>
}

export default async function EditarProductosPage({ params }: EditPageProps): Promise<React.JSX.Element> {
  const { id } = await params

  const [productoResult, unidadesResult, almacenesResult, listasPreciosResult, vendorsResult, categoriasResult] =
    await Promise.all([
      getProductoByIdAction(id),
      getUnidadesAction(),
      getAlmacenesAction(),
      getListasPreciosAction(),
      getVendorsAction(),
      getCategoriasAction(),
    ])

  return (
    <ProductoFormPageClient
      mode="edit"
      producto={productoResult.success ? (productoResult.data as unknown as Producto) : undefined}
      unidades={unidadesResult.data ?? []}
      almacenes={almacenesResult.data ?? []}
      listasPrecios={listasPreciosResult.data?.map((l) => ({ id: l.id, nombre: l.nombre })) ?? []}
      vendors={vendorsResult.data ?? []}
      categorias={categoriasResult.data ?? []}
    />
  )
}
