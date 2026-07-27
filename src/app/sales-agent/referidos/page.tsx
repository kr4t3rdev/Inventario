import { getSalesAgentDashboardAction } from '@/features/sales-agent/actions';
import { SalesAgentDashboard } from '@/features/sales-agent/components/sales-agent-dashboard';
import { getConfiguredPublicAppUrl } from '@/features/sales-agent/public-url';

/**
 * @description Carga el DTO ownership-safe y renderiza el panel real del Gestor.
 * @returns {Promise<React.JSX.Element>} Dashboard financiero y de referidos.
 */
export default async function SalesAgentReferralsPage(): Promise<React.JSX.Element> {
  const result = await getSalesAgentDashboardAction({});
  if (!result.success || !result.data) {
    return <p role="alert">No se pudo cargar el panel de referidos.</p>;
  }
  return (
    <SalesAgentDashboard
      data={result.data}
      origin={getConfiguredPublicAppUrl()}
    />
  );
}
