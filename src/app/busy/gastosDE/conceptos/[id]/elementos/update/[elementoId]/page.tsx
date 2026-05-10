/**
 * @description Página de edición de Elemento de Gasto (Server Component).
 *
 * Resuelve en el servidor:
 * - Datos del concepto padre (para obtener el elemento específico)
 *
 * El formulario (GastoElementoForm) es un Client Component que recibe los datos iniciales.
 */
import { getGastoConceptoByIdAction } from "@/features/gastosDE/actions"
import { GastoElementoForm } from "@/features/gastosDE"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

interface Props {
  params: Promise<{ id: string; elementoId: string }>
}

export default async function UpdateGastoElementoPage({ params }: Props) {
  const { id: conceptoId, elementoId } = await params

  const conceptoResult = await getGastoConceptoByIdAction(conceptoId)

  if (!conceptoResult.success) {
    notFound()
  }

  const concepto = conceptoResult.data
  // @ts-expect-error
  const elemento = concepto.elementos?.find((e) => e.elementoId === elementoId)

  if (!elemento) {
    notFound()
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-6 max-w-2xl">
          <div className="mb-4">
            <Button variant="ghost" asChild>
              <Link href={`/busy/gastosDE/conceptos/${conceptoId}/elementos`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la lista
              </Link>
            </Button>
          </div>
          <GastoElementoForm
            conceptoId={conceptoId}
  // @ts-expect-error
            conceptoNombre={concepto.nombre}
            initialData={elemento}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}