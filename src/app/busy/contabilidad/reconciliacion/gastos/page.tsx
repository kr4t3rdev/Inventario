/**
 * @description Página de reconciliación de gastos.
 * Server Component que renderiza el componente cliente.
 *
 * @returns {JSX.Element} Vista de reconciliación de gastos.
 */
import { ReconciliacionGastosPage } from "@/features/contabilidad/components/reconciliacion/reconciliacion-gastos-page"


export const metadata = {
  title: "Reconciliar Gastos - FinanceMDM",
}

export default function GastosReconciliacionPage() {
  return <ReconciliacionGastosPage />
}
