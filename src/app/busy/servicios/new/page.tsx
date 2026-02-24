import type { Metadata } from "next"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ServicioForm } from "@/components/servicios/servicios-form"

export const metadata: Metadata = {
  title: "Nuevo Servicio",
  description: "Registrar un nuevo servicio",
}

export default function NuevoServicioPage() {
  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Nuevo Servicio</h1>
            <p className="text-muted-foreground">Ingrese los datos para registrar un nuevo servicio</p>
          </div>
          <ServicioForm />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}