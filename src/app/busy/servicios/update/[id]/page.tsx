/**
 * @description Página de edición de Servicio (Server Component).
 *
 * Resuelve en el servidor:
 * - Datos del servicio a editar
 *
 * El formulario (ServicioForm) es un Client Component que recibe los datos iniciales.
 */
import { getServicioByIdAction } from "@/features/servicios/actions"
import { getVendorsAction } from "@/features/vendors/actions"
import { ServicioForm } from "@/features/servicios/components/servicios-form"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { notFound } from "next/navigation"


export const metadata = {
  title: "Editar Servicio - FinanceMDM",
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarServicioPage({ params }: Props) {
  const { id: servicioId } = await params

  const [servicioResult, vendorsResult] = await Promise.all([
    getServicioByIdAction(servicioId),
    getVendorsAction(),
  ])

  if (!servicioResult.success) {
    notFound()
  }

  const servicio = servicioResult.data
  const initialVendors = vendorsResult.success ? vendorsResult.data ?? [] : []

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Editar Servicios</h1>
            <p className="text-muted-foreground">Modifique los datos de los Servicios</p>
          </div>
            <ServicioForm initialData={servicio} initialVendors={initialVendors} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}