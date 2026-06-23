/**
 * @description Página de gestión de vacaciones de empleados.
 * Gateada por la feature `vacaciones` del plan (solo Empresarial).
 * Si el usuario no tiene el feature, redirige a /busy/empleados.
 * Admin global bypasses el check de plan (consistente con requireFeature).
 *
 * @returns {Promise<ReactElement>} Vista de vacaciones o redirect.
 */
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/server-actions"
import { VacacionesClient } from "./vacaciones-client"
import type { ReactElement } from "react"

export default async function VacacionesPage(): Promise<ReactElement> {
  const user = await getCurrentUser()

  const isAdmin = user?.role === "admin"
  if (!isAdmin && user?.planFeatures?.["vacaciones"] !== true) {
    redirect("/busy/empleados")
  }

  return <VacacionesClient />
}
