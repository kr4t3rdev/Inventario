/**
 * @description Sistema Mejorado de Asistencia de Empleados.
 * Gateada por la feature `asistencia` del plan (solo Empresarial).
 * Si el usuario no tiene el feature, redirige a /busy/empleados.
 * Admin global bypasses el check de plan (consistente con requireFeature).
 *
 * @returns {Promise<ReactElement>} Vista del sistema de asistencia o redirect.
 */
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/server-actions"
import { SistemaAsistenciaClient } from "./sistema-asistencia-client"
import type { ReactElement } from "react"

export default async function SistemaAsistenciaPage(): Promise<ReactElement> {
  const user = await getCurrentUser()

  const isAdmin = user?.role === "admin"
  if (!isAdmin && user?.planFeatures?.["asistencia"] !== true) {
    redirect("/busy/empleados")
  }

  return <SistemaAsistenciaClient />
}
