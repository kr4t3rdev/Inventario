/**
 * @description Página de gestión de nómina de empleados.
 * Gateada por la feature `nomina` del plan (solo Empresarial).
 * Si el usuario no tiene la feature, redirige a /busy/empleados.
 *
 * @returns {Promise<JSX.Element>} Vista de nómina o redirect.
 */
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/server-actions"
import { NominaClient } from "./nomina-client"

export default async function NominaPage(): Promise<JSX.Element> {
  const user = await getCurrentUser()

  if (user?.planFeatures?.["nomina"] !== true) {
    redirect("/busy/empleados")
  }

  return <NominaClient />
}
