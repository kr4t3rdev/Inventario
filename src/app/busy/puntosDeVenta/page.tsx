/**
 * @description Página principal de gestión de puntos de venta.
 * Server Component que obtiene datos iniciales via Server Actions
 * y delega la UI interactiva a PvPageClient.
 *
 * @returns {Promise<JSX.Element>} Vista de gestión de puntos de venta.
 */
import { getPuntosDeVentaAction } from "@/features/puntos-venta"
import { PvPageClient } from "@/features/puntos-venta/components/pv-page-client"


export const metadata = {
  title: "Puntos de Venta - FinanceMDM",
}

export default async function PuntosDeVentaPage() {
  const result = await getPuntosDeVentaAction()
  const puntosDeVenta = result.success ? (result.data ?? []) : []

  return <PvPageClient puntosDeVenta={puntosDeVenta} />
}
