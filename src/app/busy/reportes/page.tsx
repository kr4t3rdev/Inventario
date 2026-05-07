import type { Metadata } from 'next';

import { ReportesPageClient } from '@/features/reportes-financieros/components/reportes-page-client';

export const metadata: Metadata = {
  title: 'Reportes de Inventario',
  description: 'Genera reportes detallados del inventario',
};

/**
 * @description Página principal de reportes de inventario.
 * @returns {JSX.Element} Contenedor de la vista de reportes.
 */
export default function ReportesPage() {
  return <ReportesPageClient />;
}
