import { getEmpleadosAction } from '@/features/empleados/actions'
import { NominaEmpleadoSection } from '@/features/empleados/components'
import { getPagoSalariosAction } from '@/features/pago-salario/actions'

/**
 * @description Página principal de empleados en Server Component.
 *
 * El plan Básico integra la gestión de empleados y el historial de
 * pagos en la misma pantalla. Las rutas separadas de nómina,
 * asistencia y vacaciones quedan como módulos premium independientes.
 *
 * @returns {Promise<JSX.Element>} Página de empleados con datos precargados.
 */

export const metadata = {
  title: "Empleados - FinanceMDM",
}

export const dynamic = 'force-dynamic'

export default async function EmpleadosPage() {
  const [empleadosResult, pagosResult] = await Promise.all([
    getEmpleadosAction(),
    getPagoSalariosAction(),
  ])

  const initialEmpleados = empleadosResult.success ? empleadosResult.data ?? [] : []
  const initialPagos = pagosResult.success ? pagosResult.data ?? [] : []

  return (
    <NominaEmpleadoSection
      initialEmpleados={initialEmpleados}
      initialPagos={initialPagos as any}
    />
  )
}
