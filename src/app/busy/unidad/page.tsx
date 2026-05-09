/**
 * @description Página principal de gestión de unidades de medida.
 * Server Component que obtiene datos iniciales via Server Actions
 * y delega la UI interactiva a UnidadPageClient.
 *
 * @returns {Promise<JSX.Element>} Vista de gestión de unidades.
 */
import { getUnidadesAction } from "@/features/unidades"
import { UnidadPageClient } from "@/features/unidades/components/unidad-page-client"
import type { Unidad } from "@/features/unidades"

export default async function UnidadPage() {
  const result = await getUnidadesAction()
  const unidades: Unidad[] = result.success ? (result.data ?? []) : []

  return <UnidadPageClient unidades={unidades} />
}
