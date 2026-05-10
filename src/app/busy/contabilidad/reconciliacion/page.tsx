/**
 * @description Dashboard central para gestionar reconciliación de ventas, servicios y gastos.
 * Server Component que obtiene datos iniciales y delega la UI a ReconciliacionHubClient.
 *
 * @returns {Promise<JSX.Element>} Vista principal de reconciliación.
 */
import { getReconciliacionStatsAction } from "@/features/contabilidad/actions-reconciliacion"
import { ReconciliacionHubClient } from "@/features/contabilidad/components/reconciliacion-hub-client"

export default async function ReconciliacionHubPage() {
  const result = await getReconciliacionStatsAction()
  const initialStats = result.success ? result.data : null

  return <ReconciliacionHubClient initialStats={initialStats} />
}
