import { getEmpleadosAction } from '@/features/empleados/actions'
import { getPagoSalariosAction } from '@/features/pago-salario/actions'
import { EmpleadosNominaContent } from '@/features/empleados/components'

/**
 * @description Página principal de empleados y nómina en Server Component.
 * @returns {Promise<JSX.Element>} Página de empleados con datos precargados.
 */
export const dynamic = 'force-dynamic'

export default async function EmpleadosPage() {
  const [empleadosResult, pagosResult] = await Promise.all([
    getEmpleadosAction(),
    getPagoSalariosAction(),
  ])

  const initialEmpleados = empleadosResult.success ? empleadosResult.data ?? [] : []
  const initialPagos = pagosResult.success ? pagosResult.data ?? [] : []

  return (
    <EmpleadosNominaContent
  // @ts-expect-error
      initialEmpleados={initialEmpleados}
  // @ts-expect-error
      initialPagos={initialPagos}
    />
  )
}
