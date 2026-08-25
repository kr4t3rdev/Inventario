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
import { ExpenseHealthCard } from "@/features/gastosDE/components/expense-health-card"
import { getCurrentUser } from "@/lib/server-actions"
import type { Vendor } from "@/app/models/model"


export const metadata = {
  title: "Gastos D/E - FinanceMDM",
}

export default async function GastosDEPage() {
  // ── Resolver datos en paralelo en el servidor ──
  const [gastosDEResult, vendorsResult, user] = await Promise.all([
    getGastosDEAction({}),
    getVendorsAction(),
    getCurrentUser(),
  ])

  const initialGastosDE = gastosDEResult.success ? gastosDEResult.data ?? [] : []
  const initialVendors = vendorsResult.success ? vendorsResult.data ?? [] : []

  return (
    <div className="space-y-6">
      {user?.role === 'admin' ? <ExpenseHealthCard userRole="admin" /> : null}
      <GastosDEContent
  // @ts-expect-error -- InitialGastosDE type mismatches GastosDEContent pending migration
      initialGastosDE={
      initialGastosDE
      }
      initialVendors={initialVendors as any}
    />
    </div>
  )
}