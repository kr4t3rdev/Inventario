import { getEmpleadosAction } from '@/features/empleados/actions'
import { EmpleadosListContent } from '@/features/empleados/components/empleados-list-content'
import { getCurrentUser } from '@/lib/server-actions'

/**
 * @description Página principal de empleados en Server Component.
 *
 * El feature `empleados` está disponible desde el plan Básico. Esta
 * página NO depende del feature `nomina` (Fix A del spec). El
 * historial de pagos vive en la subruta `/busy/empleados/nomina`,
 * que tiene su propio redirect cuando el feature no está disponible.
 *
 * @returns {Promise<JSX.Element>} Página de empleados con datos precargados.
 */

export const metadata = {
  title: "Empleados - FinanceMDM",
}

export const dynamic = 'force-dynamic'

export default async function EmpleadosPage() {
  const user = await getCurrentUser()
  const hasNomina = user?.planFeatures?.['nomina'] === true

  const result = await getEmpleadosAction()
  const initialEmpleados = result.success ? result.data ?? [] : []

  return (
    <EmpleadosListContent
      initialEmpleados={initialEmpleados}
      hasNomina={hasNomina}
    />
  )
}
