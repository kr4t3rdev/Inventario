import type { Metadata } from 'next';

import { CuadrePageClient } from '@/components/cuadre_diario/cuadre-page-client';

export const metadata: Metadata = {
  title: 'Cuadre Diario Financiero',
  description: 'Reporte de cuadre diario financiero con ventas, movimientos de caja y conciliación',
};

/**
 * @description Página principal del cuadre financiero diario.
 * @returns {JSX.Element} Vista del módulo de cuadre diario.
 */
export default function CuadrePage() {
  return <CuadrePageClient />;
}
