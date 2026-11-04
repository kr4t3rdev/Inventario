'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LazyMotion, m as motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TrendingUp, PlusCircle, ClipboardList } from 'lucide-react';
import { ManagementPageTitle } from '@/components/management-page-title';
import { VentasTable } from './ventas-table';
import { NuevoPedidoDialog } from './nuevo-pedido-dialog';
import type { Venta } from '../types';

interface VentasPageClientProps {
  ventas: Venta[];
  /** Habilita la UI del ciclo de pedidos (feature ventas-pedidos del plan). */
  pedidosEnabled?: boolean;
}

/**
 * @description Cliente de la página de ventas con animaciones
 * @param {VentasPageClientProps} props - Props del componente
 * @returns {JSX.Element} Página de ventas con animaciones
 */
export function VentasPageClient({ ventas, pedidosEnabled = false }: VentasPageClientProps) {
  const [pedidoOpen, setPedidoOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  return (
    <>
      <motion.div
        className="flex justify-between items-center mb-6"
        initial={{ opacity: 0, y: reduceMotion ? 0 : -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
      >
        <ManagementPageTitle icon={TrendingUp} title="Ventas" description="Consulta y administra las ventas." />
        <motion.div
          whileHover={reduceMotion ? undefined : { scale: 1.02 }}
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          initial={{ opacity: 0, x: reduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.2 }}
        >
          <div className="flex items-center gap-2">
            {pedidosEnabled && (
              <Button variant="outline" onClick={() => setPedidoOpen(true)}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Nuevo pedido
              </Button>
            )}
            <Button
              asChild
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/busy/sales/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nueva Venta
              </Link>
            </Button>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.3 }}
      >
        <VentasTable
          ventas={ventas as any}
          isLoading={false}
          error={null}
          onDelete={() => {}}
          pedidosEnabled={pedidosEnabled}
        />
      </motion.div>
      <NuevoPedidoDialog open={pedidoOpen} onOpenChange={setPedidoOpen} />
    </>
  );
}
