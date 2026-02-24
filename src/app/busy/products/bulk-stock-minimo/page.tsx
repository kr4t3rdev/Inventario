'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Boxes, Sparkles } from 'lucide-react'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { BulkStockMinimoManager } from '@/components/productos/bulk-stock-minimo-manager'
import { Button } from '@/components/ui/button'

/**
 * @description Página de configuración masiva de stock mínimo para productos.
 * @returns {JSX.Element} Vista de actualización masiva.
 */
export default function BulkStockMinimoPage(): React.JSX.Element {
  return (
    <SidebarProvider>
      <SidebarInset>
        <motion.div
          className="container mx-auto py-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
        >
          <motion.div
            className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="flex items-start gap-3">
              <motion.div
                className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-600 text-white shadow-lg"
                whileHover={{ scale: 1.05, rotate: 4 }}
                transition={{ duration: 0.2 }}
              >
                <Boxes className="h-6 w-6" />
                <motion.span
                  className="absolute -right-1 -top-1"
                  animate={{ rotate: 360, scale: [1, 1.15, 1] }}
                  transition={{
                    rotate: { duration: 16, repeat: Infinity, ease: 'linear' },
                    scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                  }}
                >
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                </motion.span>
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
                  Gestión Masiva de Stock Mínimo
                </h1>
                <p className="text-sm text-muted-foreground">
                  Actualiza rápidamente umbrales de inventario en múltiples productos.
                </p>
              </div>
            </div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/busy/products">
                <Button variant="outline" className="gap-2 border-dashed">
                  <ArrowLeft className="h-4 w-4" />
                  Volver a Productos
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <BulkStockMinimoManager />
          </motion.div>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  )
}
