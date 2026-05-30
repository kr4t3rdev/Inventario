/**
 * @description Página para editar un almacén existente.
 * Server Component que obtiene los datos del almacén via Server Action
 * y delega la UI a EditarAlmacenPageClient.
 *
 * @param {{ params: Promise<{ id: string }> }} props - Parámetros de la ruta.
 * @returns {Promise<JSX.Element>} Vista de edición de almacén.
 */
import { getAlmacenByIdAction } from "@/features/almacenes"
import { EditarAlmacenPageClient } from "@/features/almacenes/components/almacen-edit-page-client"


export const metadata = {
  title: "Editar Almacén - FinanceMDM",
}

export default async function EditarAlmacenPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getAlmacenByIdAction(id)
  const almacen = result.success
    ? { almacenId: result.data!.almacenId, nombre: result.data!.nombre }
    : null

  return <EditarAlmacenPageClient almacen={almacen} />
}
