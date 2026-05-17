/**
 * @description Página para editar un proveedor existente.
 * Server Component que obtiene los datos via Server Action
 * y delega la UI a EditarVendorPageClient.
 *
 * @param {{ params: Promise<{ id: string }> }} props - Parámetros de la ruta.
 * @returns {Promise<JSX.Element>} Vista de edición de proveedor.
 */
import { getVendorByIdAction } from "@/features/vendors"
import { EditarVendorPageClient } from "@/features/vendors/components/vendor-edit-page-client"


export const metadata = {
  title: "Editar Proveedor - FinanceTCP",
}

export default async function UpdateVendorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getVendorByIdAction(id)
  const vendor = result.success ? (result.data ?? null) : null

  return <EditarVendorPageClient vendor={vendor} />
}
