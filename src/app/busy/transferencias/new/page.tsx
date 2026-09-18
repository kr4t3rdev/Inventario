'use client'

/**
 * @description Página de nueva Transferencia.
 * Es Client Component porque usa motion (framer-motion) para animaciones de entrada.
 * El formulario (TransferenciaForm) también es un Client Component.
 */
import { TransferenciaForm } from "@/features/transferencias"
import { LazyMotion, m as motion } from "framer-motion"
import { ArrowLeftRight } from "lucide-react"

export default function NuevaTransferenciaPage() {
  return (
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
                className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg relative"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <ArrowLeftRight className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Nueva Transferencia
                </h1>
                <p className="text-muted-foreground text-sm">
                  Registre el movimiento de productos entre almacenes y puntos de venta
                </p>
              </div>
            </div>
          </motion.div>

          <TransferenciaForm />
        </motion.div>
  )
}