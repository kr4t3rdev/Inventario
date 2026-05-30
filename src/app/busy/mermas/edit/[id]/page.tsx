/**
 * @description Página de edición de Merma (Server Component).
 *
 * Resuelve en el servidor:
 * - Datos de la merma a editar
 *
 * Delega el renderizado animado a EditarMermaContent (Client Component).
 */
import { getMermaByIdAction, EditarMermaContent } from "@/features/mermas"
import { notFound } from "next/navigation"

export const metadata = {
  title: "Editar Merma - FinanceMDM",
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarMermaPage({ params }: Props) {
  const { id: mermaId } = await params

  const result = await getMermaByIdAction(mermaId)

  if (!result.success) {
    notFound()
  }

  const merma = result.data!

  return <EditarMermaContent merma={{ mermaId: merma.mermaId, productoId: merma.productoId, cantidad: merma.cantidad, motivo: merma.motivo }} />
}