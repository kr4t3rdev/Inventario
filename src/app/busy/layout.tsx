export const dynamic = 'force-dynamic'

import { ReactNode } from 'react'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from 'sonner'
import { AppSidebar2 } from '@/components/app-sidebar2'

/**
 * @description Layout para rutas /busy - proporciona sidebar, header y layout principal
 * @param {Object} props - Props del layout
 * @param {ReactNode} props.children - Contenido anidado
 * @returns {JSX.Element} Layout con sidebar
 */
export default function BusyLayout({ children }: { children: ReactNode }) {
  return (
    <main>
      <SidebarProvider>
        <AppSidebar2 variant="floating" />
        <SidebarInset>
          <SiteHeader />
          {children}
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </main>
  )
}
