import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { canAccessFichaCosto } from '@/features/ficha-costo/lib/access'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar2 } from '@/components/app-sidebar2'
import { ListaProductosFicha } from '@/features/ficha-costo/components/lista-productos-ficha'

export const metadata: Metadata = {
  title: 'Ficha de Costo',
  description:
    'Lista de productos y servicios del tenant con acceso a la ficha de costo y su resumen operativo.',
}

/**
 * @description Página principal de Ficha de Costo. Muestra el catálogo
 *   de productos y servicios del tenant con búsqueda y un enlace directo
 *   a la ficha de cada uno.
 */
export default async function FichaCostoPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role === 'admin' && !user.tenantId) redirect('/admin')
  if (!canAccessFichaCosto(user)) {
    redirect('/busy/dashboard')
  }
  return (
    <SidebarProvider>
      <AppSidebar2 variant="floating" />
      <SidebarInset>
        <div className="container mx-auto py-4">
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Ficha de Costo</h1>
            <p className="text-muted-foreground">
              Análisis de costo y margen para productos y servicios del catálogo.
            </p>
          </header>

          <ListaProductosFicha />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
