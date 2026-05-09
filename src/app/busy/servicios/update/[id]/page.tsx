"use client"

import { ServicioForm } from "@/features/servicios/components/servicios-form"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useGetServicioQuery } from "@/features/servicios/api/serviciosApi"
import { useParams } from "next/navigation"

export default function EditarServicioPage() {
  const params = useParams()
  const servicioId = params.id as string
  const [servicio, setServicio] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => { async function f() { setIsLoading(true); const r=await getServicioByIdAction(servicioId); if(r.success) setServicio(r.data!); else setError(true); setIsLoading(false); } f(); }, [servicioId])

  if (isLoading) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <div className="mb-6">
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-100 w-full" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (error || !servicio) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Error</h1>
              <p className="text-muted-foreground">No se pudo cargar los servicios</p>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Editar Servicios</h1>
            <p className="text-muted-foreground">Modifique los datos de los Servicios</p>
          </div>
          <ServicioForm initialData={ servicio } />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
