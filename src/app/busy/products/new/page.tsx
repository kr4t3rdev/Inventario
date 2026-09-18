/**
 * @description Página de creación de nuevo producto (Server Component).
 *   Obtiene catálogos necesarios en el servidor y los pasa al shell cliente.
 * @returns {Promise<JSX.Element>} Vista server-first del formulario de nuevo producto.
 */
import { redirect } from 'next/navigation'
import { getAlmacenesAction } from '@/features/almacenes'
import { getCategoriasAction } from '@/features/categorias'
import { getListasPreciosAction } from '@/features/listas-precios'
import { getUnidadesAction } from '@/features/unidades'
import { getVendorsAction } from '@/features/vendors'
import { ProductoFormPageClient } from '@/features/productos/components/producto-form-page-client'
import { getCurrentUser } from '@/lib/server-actions'


export const metadata = {
  title: "Nuevo Producto - FinanceMDM",
}

export default async function NuevoProductosPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser()

  if (user?.tenantRole !== 'manager') {
    redirect('/busy/products')
  }

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
      unidades={unidadesResult.success ? unidadesResult.data : []}
      almacenes={almacenesResult.success ? almacenesResult.data : []}
      listasPrecios={listasPreciosResult.success ? listasPreciosResult.data.map((l) => ({ id: l.id, nombre: l.nombre })) : []}
      vendors={vendorsResult.success ? vendorsResult.data as any : []}
      categorias={categoriasResult.success ? categoriasResult.data : []}
    />
  )
}
