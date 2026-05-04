'use client'
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "sonner"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AuthProvider } from "@/contexts/auth-context"

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main>
      <SidebarProvider>
        <AdminSidebar variant="floating" />
        <SidebarInset>
          <SiteHeader />
          <AuthProvider>
            {children}
          </AuthProvider>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </main>
  )
}

export default Layout
