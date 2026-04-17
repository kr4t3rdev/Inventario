"use client"

import { GastoDEForm } from "@/components/gastoDE/GastoDEForm"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useGetGastoDEQuery } from "@/lib/redux/services/gastosDEApi"
import { useParams } from "next/navigation"

export default function EditarGastoDEPage() {
  const params = useParams()
  const gastosDEId = params.id as string
  const { data: gastosDE, isLoading, error } = useGetGastoDEQuery(gastosDEId)
  //console.log('gastoSId',gastoSId);

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

  if (error || !gastosDE) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Error</h1>
              <p className="text-muted-foreground">No se pudo cargar los gastos de explotación</p>
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
            <h1 className="text-2xl font-bold">Editar Gasto de Explotación</h1>
            <p className="text-muted-foreground">Modifique los datos de los Gasto de Explotación</p>
          </div>
          <GastoDEForm initialData={{
            gastosDEId: gastosDE.gastosDEId,
            tipo: gastosDE.tipo,
            conceptoId: gastosDE.conceptoId,
            elementoId: gastosDE.elementoId,
            numeroFactura: gastosDE.numeroFactura,
            proveedor: gastosDE.proveedor,
            monto: gastosDE.monto,
            descripcion: gastosDE.descripcion,
            periodo: gastosDE.periodo,
          }} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
