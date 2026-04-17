"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Package, PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useDeleteTransferenciaMutation, useGetTransferenciasQuery } from "@/lib/redux/services/transferenciasApi"
import { TransferenciasTable } from "@/components/transferencias/transferencias-table"

export default function TransferenciasPage() {
  const { data: transferenciasData, isLoading, error } = useGetTransferenciasQuery()
  const transferencias = transferenciasData?.transferencias || []
  const [transferenciaToDelete, setTransferenciaToDelete] = useState<string | null>(null)
  const [deleteTransferencia] = useDeleteTransferenciaMutation()

  const handleConfirmDelete = async () => {
    if (!transferenciaToDelete) return
    try {
      const result = await deleteTransferencia(transferenciaToDelete).unwrap()
      if (result.message) {
        toast.success(result.message)
      } else {
        toast.success("La transferencia ha sido eliminada exitosamente y el stock ha sido restaurado.")
      }
    } catch (error) {
      console.error("Error al eliminar la transferencia:", error)
      toast.error("Hubo un error al eliminar la transferencia.")
    } finally {
      setTransferenciaToDelete(null)
    }
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <motion.div 
          className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 max-w-7xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <div className="flex items-center gap-4">
              <motion.div
                className="w-12 h-12 bg-linear-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20"
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Package className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Transferencias</h1>
                <p className="text-muted-foreground text-sm mt-1">Gestiona el movimiento de inventario entre ubicaciones</p>
              </div>
            </div>
            
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
            >
              <Button 
                asChild
                className="bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-md transition-all duration-300"
                size="lg"
              >
                <Link href="/busy/transferencias/new">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Nueva transferencia
                </Link>
              </Button>
            </motion.div>
          </motion.div>
          
          <TransferenciasTable 
            transferencias={transferencias || []} 
            isLoading={isLoading} 
            error={error}
            onDelete={setTransferenciaToDelete}
          />

          <AlertDialog open={!!transferenciaToDelete} onOpenChange={(open) => !open && setTransferenciaToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Esto eliminará permanentemente la transferencia
                  y revertirá los cambios de stock en las ubicaciones de origen y destino.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleConfirmDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar transferencia
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  )
}
