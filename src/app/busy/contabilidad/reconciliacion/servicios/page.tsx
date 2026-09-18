/**
 * @description Página de reconciliación de servicios.
 * Server Component que renderiza el componente cliente.
 *
 * @returns {JSX.Element} Vista de reconciliación de servicios.
 */
import { redirect } from 'next/navigation';

import { ReconciliacionServiciosPage } from "@/features/contabilidad/components/reconciliacion/reconciliacion-servicios-page"
import { getCurrentUser } from '@/lib/server-actions';
import { shouldHideBasicAccountingItem } from '@/lib/plan-access';


export const metadata = {
  title: "Reconciliar Servicios - FinanceMDM",
}

export default async function ServiciosReconciliacionPage() {
  const user = await getCurrentUser();

  if (
    user?.role !== 'admin' &&
    (
      shouldHideBasicAccountingItem(user, 'Reconciliación Servicios') ||
      user?.planFeatures?.servicios !== true
    )
  ) {
    redirect('/busy/contabilidad/reconciliacion');
  }

  return <ReconciliacionServiciosPage />
}
