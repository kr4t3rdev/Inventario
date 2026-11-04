'use client';

import Link from 'next/link';
import { m as motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ShoppingBag } from 'lucide-react';

import { ManagementPageTitle } from '@/components/management-page-title';
import { Button } from '@/components/ui/button';
import { VentaInterface } from '@/features/ventas';

/**
 * @description Presenta el formulario de nueva venta con el patrón visual de Ventas.
 * @returns {React.JSX.Element} Pantalla de nueva venta.
 */
export default function PuntoVentaPage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="container mx-auto py-4">
      <motion.div
        className="mb-6 flex items-center gap-3"
        initial={{ opacity: 0, y: reduceMotion ? 0 : -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
      >
        <Button asChild variant="outline" size="icon" aria-label="Volver a ventas">
          <Link href="/busy/sales"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <ManagementPageTitle
          icon={ShoppingBag}
          title="Nueva venta"
          description="Selecciona productos para añadir a la venta."
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.3 }}
      >
        <VentaInterface />
      </motion.div>
    </div>
  );
}
