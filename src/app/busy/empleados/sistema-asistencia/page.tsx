/**
 * @description Sistema Mejorado de Asistencia de Empleados.
 * Gateada por la feature `asistencia` del plan (solo Empresarial).
 * Si el usuario no tiene la feature, redirige a /busy/empleados.
 *
 * @returns {Promise<JSX.Element>} Vista del sistema de asistencia o redirect.
 */
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/server-actions"
import { SistemaAsistenciaClient } from "./sistema-asistencia-client"

export default async function SistemaAsistenciaPage(): Promise<JSX.Element> {
  const user = await getCurrentUser()

  if (user?.planFeatures?.["asistencia"] !== true) {
    redirect("/busy/empleados")
  }

  return <SistemaAsistenciaClient />
}
