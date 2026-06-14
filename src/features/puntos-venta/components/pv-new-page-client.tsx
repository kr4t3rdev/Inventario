"use client"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { PtoVentaForm } from "@/features/puntos-venta/components/pvtoVenta-form"
import { LazyMotion, m as motion } from "framer-motion"
import { Store } from "lucide-react"

/**
 * @description Componente cliente para la página de creación de puntos de venta.
 * @returns {JSX.Element} Vista de creación.
 */
export function NuevoPvPageClient() {
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
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <motion.div 
                className="w-12 h-12 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg relative"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <Store className="h-6 w-6 text-white" />

              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Nuevo Punto de Venta
                </h1>
                <p className="text-muted-foreground">
                  Ingrese los datos para registrar un nuevo punto de venta
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <PtoVentaForm />
          </motion.div>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  )
}
