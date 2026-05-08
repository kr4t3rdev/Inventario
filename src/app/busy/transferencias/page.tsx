"use client"

import { useEffect, useState, useTransition } from "react"
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
import { getTransferenciasAction, deleteTransferenciaAction } from "@/features/transferencias/actions"
import { TransferenciasTable } from "@/features/transferencias/components/transferencias-table"

export default function TransferenciasPage() {
  const [transferencias, setTransferencias] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => { async function f() { setIsLoading(true); const r=await getTransferenciasAction(); if(r.success) setTransferencias(r.data?.transferencias??[]); setIsLoading(false); } f(); }, [])

  const [transferenciaToDelete, setTransferenciaToDelete] = useState<string | null>(null)

  const handleConfirmDelete = async () => {
    if (!transferenciaToDelete) return
    startTransition(async () => {
      const r=await deleteTransferenciaAction(transferenciaToDelete)
      if(r.success) { toast("Transferencia cancelada exitosamente."); const ref=await getTransferenciasAction(); if(ref.success) setTransferencias(ref.data?.transferencias??[]) }
      else toast(r.error?.message||"Error al cancelar")
      setTransferenciaToDelete(null)
    })
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
