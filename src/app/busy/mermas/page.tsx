/**
 * @description Página principal de gestión de Mermas (Server Component).
 *
 * Resuelve en el servidor:
 * - Lista de mermas del tenant
 *
 * La interactividad (listado, eliminación, diálogos) se delega a
 * MermasContent como Client Component (island).
 */
import { getMermasAction } from "@/features/mermas"
import { MermasContent } from "@/features/mermas"


export const metadata = {
  title: "Mermas - FinanceTCP",
}

export default async function MermasPage() {
  const result = await getMermasAction()
  
  const initialMermas = result.success ? result.data ?? [] : []
  
  return (
    <MermasContent 
  // @ts-expect-error
      initialMermas={
      initialMermas
      }
    />
  )
}