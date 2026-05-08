"use client"

import { GastoDEForm, getGastoDEByIdAction } from "@/features/gastosDE"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function EditarGastoDEPage() {
  const params = useParams()
  const gastosDEId = params.id as string
  const [gastoDE, setGastoDE] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => { async function f() { setIsLoading(true); const r = await getGastoDEByIdAction(gastosDEId); if(r.success) setGastoDE(r.data!); setIsLoading(false); } f(); }, [gastosDEId])

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

  if (error || !gastoDE) {
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
            gastosDEId: gastoDE.gastosDEId,
            tipo: gastoDE.tipo,
            conceptoId: gastoDE.conceptoId,
            elementoId: gastoDE.elementoId,
            numeroFactura: gastoDE.numeroFactura,
            proveedor: gastoDE.proveedor,
            monto: gastoDE.monto,
            descripcion: gastoDE.descripcion,
            periodo: gastoDE.periodo,
          }} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
