/**
 * @description Página de edición de Servicio (Server Component).
 * Resuelve en el servidor los datos del servicio a editar.
 * El formulario (ServicioForm) es un Client Component que recibe los datos iniciales.
 */
import { getServicioByIdAction } from "@/features/servicios/actions"
import { ServicioForm } from "@/features/servicios/components/servicios-form"
import { notFound } from "next/navigation"

export const metadata = {
  title: "Editar Servicio - FinanceMDM",
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarServicioPage({ params }: Props) {
  const { id: servicioId } = await params

  const servicioResult = await getServicioByIdAction(servicioId)
  if (!servicioResult.success) {
    notFound()
  }

  return (
    <div className="container mx-auto py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Editar Servicios</h1>
        <p className="text-muted-foreground">Modifique los datos de los Servicios</p>
      </div>
      <ServicioForm initialData={servicioResult.data} />
    </div>
  )
}