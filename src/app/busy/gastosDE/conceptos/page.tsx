/**
 * @description Página de gestión de Conceptos de Gastos (Server Component).
 *
 * Resuelve en el servidor:
 * - Lista de conceptos de gastos con sus elementos y contadores
 *
 * La interactividad (tabla, diálogos de confirmación) se delega a
 * GastoConceptosContent como Client Component (island).
 */
import { getGastoConceptosAction } from "@/features/gastosDE/actions"
import { GastoConceptosContent } from "@/features/gastosDE"

export default async function GastoConceptosPage() {
  const conceptosResult = await getGastoConceptosAction({})
  const initialConceptos = conceptosResult.success ? conceptosResult.data ?? [] : []

  return (
    <GastoConceptosContent initialConceptos={initialConceptos} />
  )
}