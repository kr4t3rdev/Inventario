/**
 * @description Página de gestión de nómina de empleados.
 * Gateada por la feature `nomina` del plan (solo Empresarial).
 * Si el usuario no tiene el feature, redirige a /busy/empleados.
 * Admin global bypasses el check de plan (consistente con requireFeature).
 *
 * Carga empleados + pagos desde el server y los pasa al componente
 * cliente `NominaEmpleadoSection` (composición desacoplada).
 *
 * @returns {Promise<ReactElement>} Vista de nómina o redirect.
 */
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/server-actions"
import { getEmpleadosAction } from "@/features/empleados/actions"
import { getPagoSalariosAction } from "@/features/pago-salario/actions"
import { NominaEmpleadoSection } from "@/features/empleados/components"
import { shouldHideSeparateEmployeeModules } from "@/lib/plan-access"
import type { ReactElement } from "react"

export default async function NominaPage(): Promise<ReactElement> {
  const user = await getCurrentUser()

  // Admin global bypasses plan check (consistente con requireFeature)
  const isAdmin = user?.role === "admin"
  const hideSeparateModules = shouldHideSeparateEmployeeModules(user)
  if (!isAdmin && (hideSeparateModules || user?.planFeatures?.["nomina"] !== true)) {
    redirect("/busy/empleados")
  }

  // Cargar datos desde el server (Fix B del spec: desacoplar del main page)
  const [empleadosResult, pagosResult] = await Promise.all([
    getEmpleadosAction(),
    getPagoSalariosAction(),
  ])

  const initialEmpleados = empleadosResult.success
    ? (empleadosResult.data as any[]) ?? []
    : []
  const initialPagos = pagosResult.success
    ? (pagosResult.data as any[]) ?? []
    : []

  return (
    <NominaEmpleadoSection
      initialEmpleados={initialEmpleados as any}
      initialPagos={initialPagos as any}
    />
  )
}
