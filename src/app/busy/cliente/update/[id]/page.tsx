"use client"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { ClienteForm, getClienteByIdAction } from "@/features/clientes"
import { ClientesPageHeader } from "@/features/clientes/components/clientes-page-header"

export default function EditarClientePage() {
  const params = useParams()
  const clienteId = params.id as string
  const [cliente, setCliente] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => { async function f() { setIsLoading(true); const r=await getClienteByIdAction(clienteId); if(r.success) setCliente(r.data!); else setError(true); setIsLoading(false); } f(); }, [clienteId])

  if (isLoading) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <div className="mb-6">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-8 w-64 mt-2" />
              <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <Skeleton className="h-100 w-full" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (error || !cliente) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Error</h1>
              <p className="text-muted-foreground">No se pudo cargar el cliente</p>
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
          <ClientesPageHeader
            title="Editar Cliente"
            description="Modifique los datos del cliente"
          />
          <ClienteForm initialData={cliente as any} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
