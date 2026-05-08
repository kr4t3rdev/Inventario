import type { Metadata } from "next"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ClienteForm } from "@/features/clientes"

export const metadata: Metadata = {
  title: "Nueva Cliente",
  description: "Registrar un nuevo cliente",
}

export default function NuevoClientePage() {
  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Nuevo Cliente</h1>
            <p className="text-muted-foreground">Ingrese los datos para registrar un nuevo cliente</p>
          </div>
          <ClienteForm />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}