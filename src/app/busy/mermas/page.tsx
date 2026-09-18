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
import { WastageHealthCard } from "@/features/mermas/components/wastage-health-card"
import { getCurrentUser } from "@/lib/server-actions"


export const metadata = {
  title: "Mermas - FinanceMDM",
}

export default async function MermasPage() {
  const [result, user] = await Promise.all([getMermasAction(), getCurrentUser()])
  
  const initialMermas = result.success ? result.data ?? [] : []
  
  return (
    <div className="space-y-6">
      {user?.role === 'admin' ? <WastageHealthCard userRole="admin" /> : null}
      <MermasContent 
    // @ts-expect-error -- InitialMermas type mismatches MermasContent pending migration
        initialMermas={
        initialMermas
        }
      />
    </div>
  )
}