import type { Metadata } from 'next'

import { getServiciosAction } from '@/features/servicios/actions'
import { ServiciosRecibidosForm } from '@/features/servicios/components'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export const metadata: Metadata = {
  title: 'Servicios Recibidos',
  description: 'Registro de servicios recibidos y egresos asociados',
}

/**
 * @description Página para registrar servicios recibidos.
 * @returns {JSX.Element} Vista de registro de servicios recibidos.
 */
export default async function ServiciosRecibidosPage() {
  const serviciosResult = await getServiciosAction()
  const initialServicios = serviciosResult.success ? serviciosResult.data ?? [] : []

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className='container mx-auto py-4'>
          <div className='mb-6'>
            <h1 className='text-2xl font-bold'>Servicios Recibidos</h1>
            <p className='text-muted-foreground'>
              Registra servicios por los que se paga periódicamente.
            </p>
          </div>

          <ServiciosRecibidosForm initialServicios={initialServicios} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

