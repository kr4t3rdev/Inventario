export const dynamic = 'force-dynamic'

import { ReactNode } from 'react'
import { headers } from 'next/headers'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from 'sonner'
import { AppSidebar2 } from '@/components/app-sidebar2'
import { ReviewDialogProvider } from '@/features/reviews'
import { redirect } from 'next/navigation'
import { getProtectedRouteIdentity } from '@/lib/auth/server-route-identity'
import { resolveSalesAgentAccess } from '@/lib/auth/sales-agent-access'

/**
 * @description Layout para rutas /busy - proporciona sidebar, header y layout principal
 *              Oculta el SiteHeader en rutas de impresión (detectado via middleware).
 * @param {Object} props - Props del layout
 * @param {ReactNode} props.children - Contenido anidado
 * @returns {JSX.Element} Layout con sidebar
 */
export default async function BusyLayout({ children }: { children: ReactNode }) {
  const access = resolveSalesAgentAccess(await getProtectedRouteIdentity(), '/busy')
  if (!access.allowed) redirect(access.redirectTo)

  const h = await headers()
  const isPrintRoute = h.get('x-print-route') === 'true'

  return (
    <div>
      <SidebarProvider>
        <AppSidebar2 variant="floating" />
        <SidebarInset>
          {!isPrintRoute && <SiteHeader />}
          {children}
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
      <ReviewDialogProvider />
    </div>
  )
}
