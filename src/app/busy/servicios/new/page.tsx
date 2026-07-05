import type { Metadata } from "next"
import { ServicioForm } from "@/features/servicios/components/servicios-form"
import { getCurrentUser } from "@/lib/server-actions"
import { hasPlanFeature } from "@/lib/plan-access"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Nuevo Servicio",
  description: "Registrar un nuevo servicio",
}

export default async function NuevoServicioPage() {
  const user = await getCurrentUser()

  if (user?.role !== 'admin' && !hasPlanFeature(user, 'servicios')) {
    redirect('/busy')
  }

  return (
    <div className="container mx-auto py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Nuevo Servicio</h1>
        <p className="text-muted-foreground">Ingrese los datos para registrar un nuevo servicio</p>
      </div>
      <ServicioForm />
    </div>
  )
}
