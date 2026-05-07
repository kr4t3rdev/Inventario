"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { PlusCircle, TrendingUp, Sparkles, Loader2 } from "lucide-react"
import { useGetVentasQuery, useDeleteVentaMutation } from "@/features/ventas/api/ventasApi"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
const VentasTable = dynamic(() => import('@/components/ventas/ventas-table').then(mod => ({default:mod.VentasTable})))
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
import dynamic from "next/dynamic"

export default function VentasPage() {
  const { data: ventas, isLoading, error } = useGetVentasQuery()
  const [deleteVenta] = useDeleteVentaMutation()

  const [ventaToDelete, setVentaToDelete] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!ventaToDelete) return

    try {
      await deleteVenta(ventaToDelete).unwrap()
      toast("La venta ha sido eliminada exitosamente.")
    } catch (error) {
      toast("Hubo un error al eliminar la venta.")
    } finally {
      setVentaToDelete(null)
    }
  }

  if (error && !ventas) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <motion.div
              className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <TrendingUp className="h-12 w-12 opacity-30" />
              <p className="text-lg font-medium">No hay ventas registradas</p>
              <p className="text-sm">Cuando registres tu primera venta aparecerá aquí.</p>
              <Button asChild className="mt-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
                <Link href="/busy/sales/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nueva Venta
                </Link>
              </Button>
            </motion.div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (isLoading) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <motion.div 
              className="flex justify-between items-center mb-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-8 w-32" />
              </div>
              <Skeleton className="h-10 w-32" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center justify-center py-12 mb-6">
                <motion.div
                  className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Skeleton className="h-12 w-full" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <motion.div 
            className="flex justify-between items-center mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <motion.div 
                className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <TrendingUp className="h-5 w-5 text-white" />
              </motion.div>
              <div className="relative">
                <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Ventas
                </h1>
                <motion.div
                  className="absolute -right-4 -top-1"
                  animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  }}
                >
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                </motion.div>
              </div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button 
                asChild
                className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              >
                <Link href="/busy/sales/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nueva Venta
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <VentasTable
              ventas={ventas}
              isLoading={isLoading}
              error={error}
              onDelete={(id) => setVentaToDelete(id)}
            />
          </motion.div>

          <AlertDialog open={!!ventaToDelete} onOpenChange={(open) => !open && setVentaToDelete(null)}>
            <AlertDialogContent className="border-dashed">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  >
                    <TrendingUp className="h-5 w-5 text-destructive" />
                  </motion.div>
                  ¿Está seguro?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Esto eliminará permanentemente la venta y restaurará el stock del
                  producto.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete} 
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
