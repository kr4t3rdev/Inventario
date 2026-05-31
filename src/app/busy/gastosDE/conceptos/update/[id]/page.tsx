/**
 * @description Página de edición de Concepto de Gasto (Server Component).
 *
 * Resuelve en el servidor:
 * - Datos del concepto a editar
 *
 * El formulario (GastoConceptoForm) es un Client Component que recibe los datos iniciales.
 */
import { getGastoConceptoByIdAction } from "@/features/gastosDE/actions"
import { GastoConceptoForm } from "@/features/gastosDE"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"


export const metadata = {
  title: "Editar Concepto - FinanceMDM",
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function UpdateGastoConceptoPage({ params }: Props) {
  const { id: conceptoId } = await params

  const conceptoResult = await getGastoConceptoByIdAction(conceptoId)

  if (!conceptoResult.success) {
    notFound()
  }

  const concepto = conceptoResult.data

  return (
        <div className="container mx-auto py-6 max-w-2xl">
          <div className="mb-4">
            <Button variant="ghost" asChild>
              <Link href="/busy/gastosDE/conceptos">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la lista
              </Link>
            </Button>
          </div>
          <GastoConceptoForm initialData={concepto} />
        </div>
  )
}