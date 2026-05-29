import type { Metadata } from 'next';
import { ArqueosPageClient } from '@/features/arqueo-caja/components/arqueos-page-client';

export const metadata: Metadata = {
  title: 'Historial de Arqueos',
  description: 'Historial de arqueos de caja realizados en todos los puntos de venta',
};

/**
 * @description Página de historial de arqueos de caja.
 * @returns {JSX.Element} Vista del módulo de arqueos.
 */
export default function ArqueosPage() {
  return <ArqueosPageClient />;
}
