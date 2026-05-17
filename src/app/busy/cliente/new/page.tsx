import type { Metadata } from "next"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ClienteForm } from "@/features/clientes"
import { ClientesPageHeader } from "@/features/clientes/components/clientes-page-header"

export const metadata: Metadata = {
  title: "Nuevo Cliente",
  description: "Registrar un nuevo cliente",
}

export default function NuevoClientePage() {
  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <ClientesPageHeader
            title="Nuevo Cliente"
            description="Ingrese los datos para registrar un nuevo cliente"
          />
          <ClienteForm />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
