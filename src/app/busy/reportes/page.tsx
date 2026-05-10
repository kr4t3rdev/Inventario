import type { Metadata } from 'next';

import { getTransferenciasAction } from '@/features/transferencias';
import { ReportesPageClient } from '@/features/reportes-financieros/components/reportes-page-client';

export const metadata: Metadata = {
  title: 'Reportes de Inventario',
  description: 'Genera reportes detallados del inventario',
};

/**
 * @description Página principal de reportes de inventario.
 * @returns {Promise<JSX.Element>} Contenedor de la vista de reportes.
 */
export default async function ReportesPage() {
  const result = await getTransferenciasAction({});
  const initialTransferencias = result.success ? result.data?.transferencias ?? [] : [];

  return <ReportesPageClient initialTransferencias={initialTransferencias} />;
}
