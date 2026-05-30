/**
 * @description Página principal de gestión de almacenes.
 * Server Component que obtiene datos iniciales via Server Actions
 * y delega la UI interactiva a AlmacenPageClient.
 *
 * La data se refresca automáticamente cuando el cliente llama a
 * router.refresh() después de eliminar un almacén, gracias
 * a revalidatePath() dentro de deleteAlmacenAction.
 *
 * @returns {Promise<JSX.Element>} Vista de gestión de almacenes.
 */
import { getAlmacenesAction } from "@/features/almacenes"
import { AlmacenPageClient } from "@/features/almacenes/components/almacen-page-client"
import type { Almacen } from "@/features/almacenes"


export const metadata = {
  title: "Almacenes - FinanceMDM",
}

export const dynamic = 'force-dynamic'

export default async function AlmacenPage() {
  const result = await getAlmacenesAction()
  const almacenes: Almacen[] = (result.success ? (result.data ?? []) : []) as unknown as Almacen as unknown as []

  return (
    <AlmacenPageClient
      almacenes={almacenes}
    />
  )
}
