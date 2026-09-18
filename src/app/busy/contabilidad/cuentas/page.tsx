/**
 * @description Página de gestión de cuentas bancarias.
 * Server Component que obtiene datos via Server Action
 * y delega la UI interactiva a CuentasPageClient.
 *
 * @returns {Promise<JSX.Element>} Vista de cuentas bancarias.
 */
import { getCuentasBancariasAction } from "@/features/contabilidad/actions-cuentas-bancarias"
import { CuentasPageClient } from "@/features/contabilidad/components/cuentas-page-client"
import { serializePrismaData } from "@/lib/prisma-utils"


export const metadata = {
  title: "Cuentas - FinanceMDM",
}

export default async function CuentasBancariasPage() {
  const result = await getCuentasBancariasAction()
  const cuentas = result.success ? (result.data?.cuentas ?? []) : []

  return (
    <CuentasPageClient
      cuentas={serializePrismaData(cuentas)}
      error={result.success ? undefined : (result.error?.message ?? 'No se pudieron cargar las cuentas bancarias.')}
    />
  )
}
