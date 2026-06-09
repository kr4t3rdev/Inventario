/**
 * @description Página para editar un punto de venta existente.
 * Server Component que obtiene los datos via Server Action
 * y delega la UI a EditarPvPageClient.
 *
 * @param {{ params: Promise<{ id: string }> }} props - Parámetros de la ruta.
 * @returns {Promise<JSX.Element>} Vista de edición.
 */
import { getPuntoDeVentaByIdAction } from "@/features/puntos-venta"
import { EditarPvPageClient } from "@/features/puntos-venta/components/pv-edit-page-client"


export const metadata = {
  title: "Editar Punto de Venta - FinanceMDM",
}

export default async function EditarPuntoVentaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getPuntoDeVentaByIdAction(id)
  const puntoVenta = result.success ? (result.data ?? null) : null

  return <EditarPvPageClient puntoVenta={puntoVenta} />
}
