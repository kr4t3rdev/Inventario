/**
 * @description Página principal de gestión de Transferencias (Server Component).
 *
 * Resuelve en el servidor:
 * - Lista de transferencias del tenant
 *
 * La interactividad (listado, eliminación, diálogos) se delega a
 * TransferenciasContent como Client Component (island).
 */
import { getTransferenciasAction } from "@/features/transferencias"
import { TransferenciasContent } from "@/features/transferencias"


export const metadata = {
  title: "Transferencias - FinanceMDM",
}

export default async function TransferenciasPage() {
  const result = await getTransferenciasAction({})
  
  const initialTransferencias = result.success ? result.data?.transferencias ?? [] : []
  
  return (
    <TransferenciasContent 
      initialTransferencias={initialTransferencias}
    />
  )
}