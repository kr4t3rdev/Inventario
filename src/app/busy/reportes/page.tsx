import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getTransferenciasAction } from '@/features/transferencias';
import { ReportesPageClient } from '@/features/reportes-financieros/components/reportes-page-client';
import { hasPlanFeature } from '@/lib/plan-access';
import { getCurrentUser } from '@/lib/server-actions';

export const metadata: Metadata = {
  title: 'Reportes de Inventario',
  description: 'Genera reportes detallados del inventario',
};

/**
 * @description Página principal de reportes de inventario.
 * @returns {Promise<JSX.Element>} Contenedor de la vista de reportes.
 */
export const dynamic = 'force-dynamic'

export default async function ReportesPage() {
  const user = await getCurrentUser();

  if (user?.role !== 'admin' && !hasPlanFeature(user, 'reportes-financieros')) {
    redirect('/busy');
  }

  const result = await getTransferenciasAction({});
  const initialTransferencias = result.success ? result.data?.transferencias ?? [] : [];

  return <ReportesPageClient initialTransferencias={initialTransferencias} />;
}
