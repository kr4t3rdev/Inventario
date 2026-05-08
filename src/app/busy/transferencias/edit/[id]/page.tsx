"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getTransferenciaByIdAction } from "@/features/transferencias"
import { TransferenciaForm } from "@/features/transferencias/components/transferencias-form"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"
import { ArrowLeftRight, Sparkles } from "lucide-react"

export default function EditarTransferenciaPage() {
  const params = useParams()
  const transferenciaId = params.id as string
  const [transferencia, setTransferencia] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => { async function f() { setIsLoading(true); const r=await getTransferenciaByIdAction(transferenciaId); if(r.success) setTransferencia(r.data!); setIsLoading(false); } f(); }, [transferenciaId])

  if (isLoading) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <motion.div 
              className="mb-6 flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
               <Skeleton className="h-10 w-10 rounded-xl" />
               <div className="space-y-2">
                 <Skeleton className="h-8 w-64" />
                 <Skeleton className="h-4 w-48" />
               </div>
            </motion.div>
            <Skeleton className="h-[600px] w-full rounded-xl" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (error || !transferencia) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4 flex flex-col items-center justify-center min-h-[50vh]">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-4"
            >
              <h1 className="text-3xl font-bold text-destructive">Error</h1>
              <p className="text-muted-foreground text-lg">No se pudo cargar la transferencia solicitada.</p>
            </motion.div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <motion.div 
          className="container mx-auto py-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <motion.div 
                className="w-10 h-10 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg relative"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <ArrowLeftRight className="h-5 w-5 text-white" />
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 10, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="absolute -top-1 -right-1"
                >
                  <Sparkles className="h-3 w-3 text-yellow-300" />
                </motion.div>
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Editar Transferencia
                </h1>
                <p className="text-muted-foreground text-sm">
                  Modifique los datos de la transferencia existente
                </p>
              </div>
            </div>
          </motion.div>

          <TransferenciaForm initialData={{
            transferenciaId: transferencia.transferenciaId,
            productos: [{ productoId: transferencia.productoId, cantidad: transferencia.cantidad }],
            tipoOrigen: transferencia.puntoDeVentaOrigen ? "punto_venta" : "almacen",
            origenId: transferencia.puntoDeVentaOrigenId || transferencia.origenId || "",
            tipoDestino: transferencia.puntoDeVentaDestino ? "punto_venta" : "almacen",
            destinoId: transferencia.puntoDeVentaDestinoId || transferencia.destinoId || "",
            descripcion: transferencia.descripcion
          }} />
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  )
}
