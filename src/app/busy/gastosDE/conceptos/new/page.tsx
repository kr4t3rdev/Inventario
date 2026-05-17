/**
 * @description Página de nuevo Concepto de Gasto (Server Component).
 *
 * El formulario (GastoConceptoForm) es un Client Component.
 */
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { GastoConceptoForm } from "@/features/gastosDE"


export const metadata = {
  title: "Nuevo Concepto - FinanceTCP",
}

export default function NewGastoConceptoPage() {
  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-6 max-w-2xl">
          <GastoConceptoForm />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}