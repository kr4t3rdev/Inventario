/**
 * @description Página de creación de nuevo producto (Server Component).
 *   Obtiene catálogos necesarios en el servidor y los pasa al shell cliente.
 * @returns {Promise<JSX.Element>} Vista server-first del formulario de nuevo producto.
 */
import { getAlmacenesAction } from '@/features/almacenes'
import { getCategoriasAction } from '@/features/categorias'
import { getListasPreciosAction } from '@/features/listas-precios'
import { getUnidadesAction } from '@/features/unidades'
import { getVendorsAction } from '@/features/vendors'
import { ProductoFormPageClient } from '@/features/productos/components/producto-form-page-client'


export const metadata = {
  title: "Nuevo Producto - FinanceTCP",
}

export default async function NuevoProductosPage(): Promise<React.JSX.Element> {
  const [unidadesResult, almacenesResult, listasPreciosResult, vendorsResult, categoriasResult] =
    await Promise.all([
      getUnidadesAction(),
      getAlmacenesAction(),
      getListasPreciosAction(),
      getVendorsAction(),
      getCategoriasAction(),
    ])

  return (
    <ProductoFormPageClient
      mode="new"
      unidades={unidadesResult.data ?? []}
      almacenes={almacenesResult.data ?? []}
      listasPrecios={listasPreciosResult.data?.map((l) => ({ id: l.id, nombre: l.nombre })) ?? []}
      vendors={vendorsResult.data ?? []}
      categorias={categoriasResult.data ?? []}
    />
  )
}
