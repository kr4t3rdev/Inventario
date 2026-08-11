"use client"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { VendorForm } from "@/features/vendors/components/vendor-form"
import { LazyMotion, m as motion } from "framer-motion"
import { Building2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

/**
 * @description Componente cliente para la página de creación de proveedores.
 * @returns {JSX.Element} Vista de creación de proveedor.
 */
export function NuevoVendorPageClient() {
  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <motion.div 
            className="mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link href="/busy/vendor">
                  <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Volver a proveedores">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              </motion.div>
              <motion.div 
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <motion.div 
                  className="w-10 h-10 bg-linear-to-br from-primary to-purple rounded-xl flex items-center justify-center shadow-lg"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Building2 className="h-5 w-5 text-white" />
                </motion.div>
                <div className="relative">
                  <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-purple bg-clip-text text-transparent">
                    Nuevo Proveedor
                  </h1>

                </div>
              </motion.div>
            </div>
            <motion.p 
              className="text-muted-foreground ml-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Ingrese los datos para registrar un nuevo proveedor
            </motion.p>
          </motion.div>
          <VendorForm />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
