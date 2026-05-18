export const dynamic = 'force-dynamic'

import { ReactNode } from 'react'
import { headers } from 'next/headers'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from 'sonner'
import { AppSidebar2 } from '@/components/app-sidebar2'

/**
 * @description Layout para rutas /busy - proporciona sidebar, header y layout principal
 *              Oculta el SiteHeader en rutas de impresión (detectado via middleware).
 * @param {Object} props - Props del layout
 * @param {ReactNode} props.children - Contenido anidado
 * @returns {JSX.Element} Layout con sidebar
 */
export default async function BusyLayout({ children }: { children: ReactNode }) {
  const h = await headers()
  const isPrintRoute = h.get('x-print-route') === 'true'

  return (
    <main>
      <SidebarProvider>
        <AppSidebar2 variant="floating" />
        <SidebarInset>
          {!isPrintRoute && <SiteHeader />}
          {children}
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </main>
  )
}
