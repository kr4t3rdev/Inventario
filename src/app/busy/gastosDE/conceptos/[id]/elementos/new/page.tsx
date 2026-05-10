/**
 * @description Página de nuevo Elemento de Gasto (Server Component).
 *
 * Resuelve en el servidor:
 * - Datos del concepto padre (para mostrar el nombre en el formulario)
 *
 * El formulario (GastoElementoForm) es un Client Component.
 */
import { getGastoConceptoByIdAction } from "@/features/gastosDE/actions"
import { GastoElementoForm } from "@/features/gastosDE"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { notFound } from "next/navigation"

interface Props {
  params: Promise<{ id: string }>
}

export default async function NewGastoElementoPage({ params }: Props) {
  const { id: conceptoId } = await params

  const conceptoResult = await getGastoConceptoByIdAction(conceptoId)

  if (!conceptoResult.success) {
    notFound()
  }

  const concepto = conceptoResult.data

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-6 max-w-2xl">
          <GastoElementoForm conceptoId={conceptoId} conceptoNombre={concepto.nombre} />
        </div>
      </SidebarInset>
  // @ts-expect-error
    </SidebarProvider>
  )
}