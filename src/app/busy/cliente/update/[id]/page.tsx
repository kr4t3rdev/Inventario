"use client"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useParams } from "next/navigation"
import { useGetAlmacenQuery } from "@/lib/redux/services/almacenesApi"
import { AlmacenForm } from "@/components/almacen/almacen-form"
import { useGetClienteQuery } from "@/lib/redux/services/ClienteApi"
import { ClienteForm } from "@/components/clientes/clientes-form"

export default function EditarClientePage() {
  const params = useParams()
  const clienteId = params.id as string
  const { data: cliente, isLoading, error } = useGetClienteQuery(clienteId)

  console.log(cliente);

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

  if (error || !cliente) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Error</h1>
              <p className="text-muted-foreground">No se pudo cargar los clientes</p>
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
            <h1 className="text-2xl font-bold">Editar Cliente</h1>
            <p className="text-muted-foreground">Modifique los datos del cliente</p>
          </div>
          <ClienteForm initialData={cliente as any} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
