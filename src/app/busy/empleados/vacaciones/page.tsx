/**
 * @description Página de gestión de vacaciones de empleados.
 * Gateada por la feature `vacaciones` del plan (solo Empresarial).
 * Si el usuario no tiene la feature, redirige a /busy/empleados.
 *
 * @returns {Promise<JSX.Element>} Vista de vacaciones o redirect.
 */
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/server-actions"
import { VacacionesClient } from "./vacaciones-client"

export default async function VacacionesPage(): Promise<JSX.Element> {
  const user = await getCurrentUser()

  if (user?.planFeatures?.["vacaciones"] !== true) {
    redirect("/busy/empleados")
  }

  return <VacacionesClient />
}
