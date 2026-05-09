/**
 * @description Página para crear un nuevo punto de venta.
 * Server Component que delega la UI a NuevoPvPageClient.
 *
 * @returns {JSX.Element} Vista de creación.
 */
import { NuevoPvPageClient } from "@/features/puntos-venta/components/pv-new-page-client"

export default function NuevoPuntoVentaPage() {
  return <NuevoPvPageClient />
}
