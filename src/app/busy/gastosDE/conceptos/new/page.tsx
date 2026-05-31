/**
 * @description Página de nuevo Concepto de Gasto (Server Component).
 *
 * El formulario (GastoConceptoForm) es un Client Component.
 */
import { GastoConceptoForm } from "@/features/gastosDE"


export const metadata = {
  title: "Nuevo Concepto - FinanceMDM",
}

export default function NewGastoConceptoPage() {
  return (
        <div className="container mx-auto py-6 max-w-2xl">
          <GastoConceptoForm />
        </div>
  )
}