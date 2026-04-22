import type { Metadata } from 'next'

import { ServiciosRecibidosForm, ServiciosRecibidosTable } from '@/components/servicios'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export const metadata: Metadata = {
  title: 'Servicios Recibidos',
  description: 'Registro de servicios recibidos y egresos asociados',
}

/**
 * @description Página para registrar y ver servicios recibidos.
 * @returns {JSX.Element} Vista de registro y listado de servicios recibidos.
 */
export default function ServiciosRecibidosPage() {
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

          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            <div className='lg:col-span-2'>
              <div className='mb-8'>
                <h2 className='text-lg font-semibold mb-4'>Servicios Registrados</h2>
                <ServiciosRecibidosTable />
              </div>
            </div>
            <div>
              <h2 className='text-lg font-semibold mb-4'>Registrar Nuevo Servicio</h2>
              <ServiciosRecibidosForm />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

