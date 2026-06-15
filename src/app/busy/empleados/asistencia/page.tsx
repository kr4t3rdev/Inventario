/**
 * @description Página de registro de asistencia de empleados.
 * Gateada por la feature `asistencia` del plan (solo Empresarial).
 * Si el usuario no tiene la feature, redirige a /busy/empleados.
 *
 * @returns {Promise<JSX.Element>} Vista de asistencia o redirect.
 */
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/server-actions"
import { AsistenciaClient } from "./asistencia-client"

export default async function AsistenciaPage(): Promise<JSX.Element> {
  const user = await getCurrentUser()

  if (user?.planFeatures?.["asistencia"] !== true) {
    redirect("/busy/empleados")
  }

  return <AsistenciaClient />
}
