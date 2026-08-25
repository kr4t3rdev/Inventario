'use client';

import Link from 'next/link';
import { LazyMotion, m as motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TrendingUp, PlusCircle } from 'lucide-react';
import { VentasTable } from './ventas-table';
import type { Venta } from '../types';

interface VentasPageClientProps {
  ventas: Venta[];
}

/**
 * @description Cliente de la página de ventas con animaciones
 * @param {VentasPageClientProps} props - Props del componente
 * @returns {JSX.Element} Página de ventas con animaciones
 */
export function VentasPageClient({ ventas }: VentasPageClientProps) {
  return (
    <>
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
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            <TrendingUp className="h-5 w-5 text-white" />
          </motion.div>
          <div className="relative">
            <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
              Ventas
            </h1>
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
          ventas={ventas as any}
          isLoading={false}
          error={null}
          onDelete={() => {}}
        />
      </motion.div>
    </>
  );
}
