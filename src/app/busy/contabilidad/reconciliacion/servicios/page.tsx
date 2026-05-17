/**
 * @description Página de reconciliación de servicios.
 * Server Component que renderiza el componente cliente.
 *
 * @returns {JSX.Element} Vista de reconciliación de servicios.
 */
import { ReconciliacionServiciosPage } from "@/features/contabilidad/components/reconciliacion/reconciliacion-servicios-page"


export const metadata = {
  title: "Reconciliar Servicios - FinanceTCP",
}

export default function ServiciosReconciliacionPage() {
  return <ReconciliacionServiciosPage />
}
