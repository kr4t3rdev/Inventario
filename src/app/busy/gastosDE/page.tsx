/**
 * @description Página principal de gestión de Gastos de Explotación (Server Component).
 *
 * Resuelve en el servidor:
 * - Lista inicial de gastos DE del tenant
 * - Proveedores (vendors) disponibles para filtros y formularios
 *
 * La interactividad (tabla, filtros, diálogos de confirmación) se delega a
 * GastosDEContent como Client Component (island).
 */
import { getGastosDEAction } from "@/features/gastosDE/actions"
import { getVendorsAction } from "@/features/vendors/actions"
import { GastosDEContent } from "@/features/gastosDE"
import type { Vendor } from "@/app/models/model"


export const metadata = {
  title: "Gastos D/E - FinanceMDM",
}

export default async function GastosDEPage() {
  // ── Resolver datos en paralelo en el servidor ──
  const [gastosDEResult, vendorsResult] = await Promise.all([
    getGastosDEAction({}),
    getVendorsAction(),
  ])

  const initialGastosDE = gastosDEResult.success ? gastosDEResult.data ?? [] : []
  const initialVendors = vendorsResult.success ? vendorsResult.data ?? [] : []

  return (
    <GastosDEContent
  // @ts-expect-error
      initialGastosDE={
      initialGastosDE
      }
      initialVendors={initialVendors}
    />
  )
}