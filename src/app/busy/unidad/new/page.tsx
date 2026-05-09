/**
 * @description Página para crear una nueva unidad de medida.
 * Server Component que delega la UI a NuevaUnidadPageClient.
 *
 * @returns {JSX.Element} Vista de creación de unidad.
 */
import { NuevaUnidadPageClient } from "@/features/unidades/components/unidad-new-page-client"

export default function NewUnidad() {
  return <NuevaUnidadPageClient />
}
