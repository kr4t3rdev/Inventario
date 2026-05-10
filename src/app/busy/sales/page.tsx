/**
 * @description Página de lista de ventas - Server Component
 * @module app/busy/sales/page
 */

import Link from "next/link"
import { getVentasAction } from "@/features/ventas/actions"
import { VentasTable } from "@/features/ventas"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, PlusCircle, Sparkles } from "lucide-react"

/**
 * @description Página principal de ventas
 * @returns {Promise<JSX.Element>} Página de ventas
 */
export default async function VentasPage() {
  // Obtener datos del servidor
  const result = await getVentasAction()
  const ventas = result.success ? result.data ?? [] : []

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

          {/* VentasTable handles the interactive UI - it's already a Client Component */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <VentasTable
  // @ts-expect-error
              ventas={ventas}
              isLoading={false}
              error={null}
              onDelete={() => {}} // Server-side delete not implemented - users can delete from detail page
            />
          </motion.div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}