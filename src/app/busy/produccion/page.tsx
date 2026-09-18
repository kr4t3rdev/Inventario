/**
 * @description Página principal de Producción (Server Component).
 *
 * Resuelve en el servidor:
 * - Lista de recetas de producción
 * - Lista de órdenes de producción
 *
 * La interactividad se delega a ProduccionContent como Client Component.
 */
import { getRecetasProduccionAction, getOrdenesProduccionAction } from "@/features/produccion"
import { ProduccionContent } from "@/features/produccion"


export const metadata = {
  title: "Producción - FinanceMDM",
}

export default async function ProduccionPage() {
  // ── Resolver datos en paralelo en el servidor ──
  const [recetasResult, ordenesResult] = await Promise.all([
    getRecetasProduccionAction({}),
    getOrdenesProduccionAction({}),
  ])

  const initialRecetas = recetasResult.success ? recetasResult.data?.data ?? [] : []
  const initialOrdenes = ordenesResult.success ? ordenesResult.data?.data ?? [] : []

  return (
    <ProduccionContent
  // @ts-expect-error TODO: fix type cast for recetas array
      initialRecetas={
      initialRecetas
      }
  // @ts-expect-error TODO: fix type cast for ordenes array
      initialOrdenes={
      initialOrdenes
      }
    />
  )
}