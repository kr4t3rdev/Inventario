'use client'

import Link from 'next/link'
import { LazyMotion, m as motion } from 'framer-motion'
import { ArrowLeft, Boxes } from 'lucide-react'

import { BulkStockMinimoManager } from '@/features/productos/components/bulk-stock-minimo-manager'
import { Button } from '@/components/ui/button'

/**
 * @description Vista cliente con animaciones de la página de stock mínimo masivo.
 * El gate de plan se aplica en el Server Component padre (page.tsx).
 * @returns {JSX.Element} Vista de actualización masiva.
 */
export function BulkStockMinimoClient(): React.JSX.Element {
  return (
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
            className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-600 text-white shadow-lg"
            whileHover={{ scale: 1.05, rotate: 4 }}
            transition={{ duration: 0.2 }}
          >
            <Boxes className="h-6 w-6" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:from-slate-300">
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
  )
}
