import type { Metadata } from "next"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { GastoDEForm } from "@/features/gastosDE"

export const metadata: Metadata = {
  title: "Nuevo Gasto de Explotación",
  description: "Registrar un nuevo Gasto de Explotación",
}

export default function NuevoGastoDEPage() {
  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Nuevo Gasto de Explotación</h1>
            <p className="text-muted-foreground">Ingrese los datos para registrar un nuevo gasto de explotación</p>
          </div>
          <GastoDEForm />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}