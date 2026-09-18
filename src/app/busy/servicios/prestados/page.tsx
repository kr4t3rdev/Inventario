import type { Metadata } from 'next'

import { getServiciosAction } from '@/features/servicios/actions'
import { ServiciosPrestadosForm } from '@/features/servicios/components'
import { getCurrentUser } from '@/lib/server-actions'
import { hasPlanFeature } from '@/lib/plan-access'
import { redirect } from 'next/navigation'
export const metadata: Metadata = {
  title: 'Servicios Prestados',
  description: 'Registro de servicios prestados a clientes',
}

/**
 * @description Página para registrar servicios prestados.
 * @returns {JSX.Element} Vista de registro de servicios prestados.
 */
export default async function ServiciosPrestadosPage() {
  const user = await getCurrentUser()

  if (user?.role !== 'admin' && !hasPlanFeature(user, 'servicios')) {
    redirect('/busy')
  }

  const serviciosResult = await getServiciosAction()
  const initialServicios = serviciosResult.success ? serviciosResult.data ?? [] : []

  return (
        <div className='container mx-auto py-4'>
          <div className='mb-6'>
            <h1 className='text-2xl font-bold'>Servicios Prestados</h1>
            <p className='text-muted-foreground'>
              Registra servicios vendidos y asociarlos opcionalmente a un cliente.
            </p>
          </div>
          <ServiciosPrestadosForm initialServicios={initialServicios} />
        </div>
  )
}
