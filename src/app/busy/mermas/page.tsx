"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useGetMermasQuery, useDeleteMermaMutation } from "@/features/mermas/api/mermasApi"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { PlusCircle, AlertTriangle, Sparkles, Loader2 } from "lucide-react"
const MermasTable = dynamic(() => import('@/components/mermas/mermas-table').then(mod => ({default:mod.MermasTable})))
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

export default function MermasPage() {
  const [mermas, setMermas] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => { async function f() { setIsLoading(true); const r=await getMermasAction(); if(r.success) setMermas(r.data??[]); setIsLoading(false); } f(); }, [])

  const [mermaToDelete, setMermaToDelete] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!mermaToDelete) return
    startTransition(async () => {
      const r=await deleteMermaAction(mermaToDelete)
      if(r.success) { toast("Merma eliminada exitosamente."); const ref=await getMermasAction(); if(ref.success) setMermas(ref.data??[]) }
      else toast(r.error?.message||"Error al eliminar la merma.")
      setMermaToDelete(null)
    })
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          {/* Header */}
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
                className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <AlertTriangle className="h-5 w-5 text-white" />
              </motion.div>
              <div className="relative">
                <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                  Mermas
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
                className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90"
              >
                <Link href="/busy/mermas/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nueva Merma
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Tabla */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <MermasTable
              mermas={mermas || []}
              isLoading={isLoading}
              error={error}
              onDelete={(id) => setMermaToDelete(id)}
            />
          </motion.div>

          {/* Diálogo de confirmación */}
          <AlertDialog open={!!mermaToDelete} onOpenChange={(open) => !open && setMermaToDelete(null)}>
            <AlertDialogContent className="border-dashed">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  >
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </motion.div>
                  ¿Está seguro?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Esto eliminará permanentemente la merma y restaurará el stock del
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
