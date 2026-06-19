import { notFound } from 'next/navigation'
import { getFichaCostoAction } from '@/features/ficha-costo/actions'
import { FichaCostoView } from '@/features/ficha-costo/components/ficha-costo-view'

/**
 * @description Página server-first que arma la ficha de costo de un
 *   producto a partir de la Server Action. Si el producto no pertenece
 *   al tenant, retorna 404 sin filtrar información.
 *
 * @param {{ params: Promise<{ id: string }> }} props - Parámetros de ruta.
 * @returns {Promise<JSX.Element>} Vista cliente con los datos.
 */
export default async function FichaCostoPage({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<React.JSX.Element> {
  const { id } = await params
  const result = await getFichaCostoAction(id)
  if (!result.success) {
    if (result.error?.code === 'NOT_FOUND') notFound()
    throw new Error(result.error?.message ?? 'Error desconocido')
  }
  return <FichaCostoView data={result.data} />
}

export const metadata = {
  title: 'Ficha de costo',
}
