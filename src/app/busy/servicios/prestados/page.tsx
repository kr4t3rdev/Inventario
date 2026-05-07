import type { Metadata } from 'next'

import { ServiciosPrestadosForm } from '@/features/servicios/components'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export const metadata: Metadata = {
  title: 'Servicios Prestados',
  description: 'Registro de servicios prestados a clientes',
}

/**
 * @description Página para registrar servicios prestados.
 * @returns {JSX.Element} Vista de registro de servicios prestados.
 */
export default function ServiciosPrestadosPage() {
  return (
    <SidebarProvider>
      <SidebarInset>
        <div className='container mx-auto py-4'>
          <div className='mb-6'>
            <h1 className='text-2xl font-bold'>Servicios Prestados</h1>
            <p className='text-muted-foreground'>
              Registra servicios vendidos y asociarlos opcionalmente a un cliente.
            </p>
          </div>
          <ServiciosPrestadosForm />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
