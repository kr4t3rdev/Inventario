export const dynamic = 'force-dynamic'

import { AdminHeader } from "@/components/admin-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "sonner"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminLayoutClient } from "@/components/admin-layout-client"
import { redirect } from "next/navigation"
import { getProtectedRouteIdentity } from "@/lib/auth/server-route-identity"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await getProtectedRouteIdentity()
  if (!identity) redirect('/login')
  if (identity.role !== 'admin') {
    redirect(identity.role === 'salesAgent' ? '/sales-agent/referidos' : '/busy/dashboard')
  }

  return (
    <AdminLayoutClient>
      <main>
        <SidebarProvider>
          <AdminSidebar variant="floating" />
          <SidebarInset>
            <AdminHeader />
            {children}
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </main>
    </AdminLayoutClient>
  )
}
