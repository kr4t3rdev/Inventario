/**
 * @description Página de gestión de Elementos de Gastos (Server Component).
 *
 * Resuelve en el servidor:
 * - Datos del concepto padre (nombre, etc.)
 * - Lista de elementos asociados al concepto
 *
 * La interactividad (tabla, diálogos de confirmación) se delega a
 * GastoElementosContent como Client Component (island).
 */
import { getGastoConceptoByIdAction, getGastoElementosAction } from "@/features/gastosDE/actions"
import { GastoElementosContent } from "@/features/gastosDE"
import { notFound } from "next/navigation"


export const metadata = {
  title: "Elementos del Concepto - FinanceMDM",
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function GastoElementosPage({ params }: Props) {
  const { id: conceptoId } = await params

  // ── Resolver datos en paralelo en el servidor ──
  const [conceptoResult, elementosResult] = await Promise.all([
    getGastoConceptoByIdAction(conceptoId),
    getGastoElementosAction(conceptoId),
  ])

  if (!conceptoResult.success) {
    notFound()
  }

  const initialConcepto = conceptoResult.data
  const initialElementos = elementosResult.success ? elementosResult.data ?? [] : []

  return (
    <GastoElementosContent
      initialConcepto={
      initialConcepto
      }
      initialElementos={initialElementos}
      conceptoId={conceptoId}
    />
  )
}
