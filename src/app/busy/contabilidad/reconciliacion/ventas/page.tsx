/**
 * @description Página de reconciliación de ventas.
 * Server Component que renderiza el componente cliente.
 *
 * @returns {JSX.Element} Vista de reconciliación de ventas.
 */
import { ReconciliacionVentasPage } from "@/features/contabilidad/components/reconciliacion/reconciliacion-ventas-page"


export const metadata = {
  title: "Reconciliar Ventas - FinanceTCP",
}

export default function VentasReconciliacionPage() {
  return <ReconciliacionVentasPage />
}
