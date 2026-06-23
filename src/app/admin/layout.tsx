export const dynamic = 'force-dynamic'

import { AdminHeader } from "@/components/admin-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "sonner"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminLayoutClient } from "@/components/admin-layout-client"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
