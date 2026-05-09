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

export default async function AlmacenPage() {
  const result = await getAlmacenesAction()
  const almacenes: Almacen[] = result.success ? (result.data ?? []) : []

  return (
    <AlmacenPageClient
      almacenes={almacenes}
    />
  )
}
