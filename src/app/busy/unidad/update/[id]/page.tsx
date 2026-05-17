/**
 * @description Página para editar una unidad de medida existente.
 * Server Component que obtiene los datos via Server Action
 * y delega la UI a EditarUnidadPageClient.
 *
 * @param {{ params: Promise<{ id: string }> }} props - Parámetros de la ruta.
 * @returns {Promise<JSX.Element>} Vista de edición de unidad.
 */
import { getUnidadByIdAction } from "@/features/unidades"
import { EditarUnidadPageClient } from "@/features/unidades/components/unidad-edit-page-client"


export const metadata = {
  title: "Editar Unidad - FinanceTCP",
}

export default async function UpdateUnidadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getUnidadByIdAction(id)
  const unidad = result.success
    ? { unidadId: result.data!.unidadId, nombre: result.data!.nombre, simbolo: result.data!.simbolo }
    : null

  return <EditarUnidadPageClient unidad={unidad} />
}
