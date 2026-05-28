/**
 * @description Página de edición de Transferencia (Server Component).
 *
 * Resuelve en el servidor:
 * - Datos de la transferencia a editar
 *
 * Delega el renderizado animado a EditarTransferenciaContent (Client Component).
 */
import { getTransferenciaByIdAction } from "@/features/transferencias"
import { EditarTransferenciaContent } from "@/features/transferencias/components/editar-transferencia-content"
import { notFound } from "next/navigation"

export const metadata = {
  title: "Editar Transferencia - FinanceTCP",
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarTransferenciaPage({ params }: Props) {
  const { id: transferenciaId } = await params

  const result = await getTransferenciaByIdAction(transferenciaId)

  if (!result.success) {
    notFound()
  }

  const transferencia = result.data

  return <EditarTransferenciaContent transferencia={transferencia as unknown as Record<string, unknown>} />
}