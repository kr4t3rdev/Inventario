/**
 * @description Página de registro de asistencia de empleados.
 * Gateada por la feature `asistencia` del plan (solo Empresarial).
 * Si el usuario no tiene el feature, redirige a /busy/empleados.
 * Admin global bypasses el check de plan (consistente con requireFeature).
 *
 * @returns {Promise<ReactElement>} Vista de asistencia o redirect.
 */
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/server-actions"
import { shouldHideSeparateEmployeeModules } from "@/lib/plan-access"
import { AsistenciaClient } from "./asistencia-client"
import type { ReactElement } from "react"

export default async function AsistenciaPage(): Promise<ReactElement> {
  const user = await getCurrentUser()

  const isAdmin = user?.role === "admin"
  const hideSeparateModules = shouldHideSeparateEmployeeModules(user)
  if (!isAdmin && (hideSeparateModules || user?.planFeatures?.["asistencia"] !== true)) {
    redirect("/busy/empleados")
  }

  return <AsistenciaClient />
}
